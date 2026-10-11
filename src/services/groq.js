/* ═══════════════════════════════════════════════════════════════════════════
   GROQ — Section 6.5
   Browser → api.groq.com directly. The key is never logged and never sent
   anywhere else (Rule 4).
   ═══════════════════════════════════════════════════════════════════════════ */

import { GroqError, OFFLINE } from './errorClassifier.js';
import { buildFullPrompt } from './promptBuilder.js';
import { parseAndValidateOutput } from './outputParser.js';
import { KF_KEYS, readLS } from '../store/storage.js';

/**
 * Groq decommissioned llama-3.3-70b-versatile and llama3-8b-8192 (the models in
 * the original spec), so Keyframe now runs on the current gpt-oss family:
 * the 120b writes the script, the 20b takes over on a 429 (separate quota
 * bucket, and faster). Both are reasoning models, so we pin reasoning_effort
 * to 'low' — otherwise the thinking tokens eat the max_tokens budget and the
 * JSON output gets truncated.
 */
export const GROQ_MODELS = [
  { id: 'openai/gpt-oss-120b', contextWindow: 131072, reasoningEffort: 'low' }, // primary
  { id: 'openai/gpt-oss-20b', contextWindow: 131072, reasoningEffort: 'low' }, // fallback on 429
];

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

/** Keeps a key out of logs/UI while still identifying which one was used. */
export function maskKey(key) {
  if (!key || key.length < 10) return '••••';
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

/**
 * resolveApiKey() → { key, source }
 * 1. the user's own key from localStorage  2. the bundled Vite env key
 */
export function resolveApiKey() {
  const userKey = String(readLS(KF_KEYS.groqKey, '') || '').trim();
  if (userKey.startsWith('gsk_')) return { key: userKey, source: 'user' };

  const envKey = String(import.meta.env.VITE_GROQ_API_KEY || '').trim();
  if (envKey.startsWith('gsk_')) return { key: envKey, source: 'built-in' };

  throw new GroqError(401, { error: 'no_api_key' });
}

export function hasUsableApiKey() {
  try {
    resolveApiKey();
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Groq's free tier allows 8,000 tokens per minute per model (RPM 1,000), and the
 * TPM check counts prompt + max_tokens together. With max_tokens 3000 and ~1.2k
 * tokens of instructions, the scraped page has to fit in roughly 3.5k tokens
 * (~14k characters). Both current models have 131k context windows, so TPM — not
 * context length — is the binding constraint. Headings survive the trim in full
 * (they drive screen names); only the body prose is shortened.
 */
const PROMPT_CHAR_BUDGET = 14000;

function trimForModel(jinaResult, model) {
  const windowChars = Math.floor(model.contextWindow * 3); // 4 chars/token, 25% headroom
  const budget = Math.min(PROMPT_CHAR_BUDGET, windowChars);
  const cleaned = String(jinaResult.cleaned || '');
  if (cleaned.length <= budget) return jinaResult;
  const trimmed = {
    ...jinaResult,
    cleaned: cleaned.slice(0, budget),
    trimmed: true,
  };
  trimmed.charCount = trimmed.cleaned.length;
  trimmed.estimatedTokens = Math.ceil(trimmed.charCount / 4);
  return trimmed;
}

/**
 * generateScript(appUrl, userInputs, jinaResult, apiKey, modelId, { signal })
 * → { output, usage, model, generationMs }
 */
export async function generateScript(appUrl, userInputs, jinaResult, apiKey, modelId, options = {}) {
  const { signal } = options;
  const model =
    GROQ_MODELS.find((m) => m.id === modelId) || GROQ_MODELS[0];
  const context = trimForModel(jinaResult, model);
  const started = performance.now();

  const { messages } = buildFullPrompt(appUrl, userInputs, context);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw Object.assign(new Error(OFFLINE.userMsg), OFFLINE);
  }

  let response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.id,
        messages,
        temperature: 0.4,
        max_tokens: 3000, // keeps prompt + completion inside the 8k TPM budget
        response_format: { type: 'json_object' },
        ...(model.reasoningEffort ? { reasoning_effort: model.reasoningEffort } : {}),
        stream: false,
      }),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    console.warn('[Keyframe] Groq request failed:', err);
    throw Object.assign(new Error(OFFLINE.userMsg), OFFLINE);
  }

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch (err) {
      body = { error: { message: `HTTP ${response.status}` } };
    }
    throw new GroqError(response.status, body);
  }

  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content;
  const output = parseAndValidateOutput(rawContent);
  const generationMs = Math.round(performance.now() - started);

  return {
    output,
    model: data?.model || model.id,
    generationMs,
    usage: {
      inputTokens: data?.usage?.prompt_tokens ?? context.estimatedTokens,
      outputTokens: data?.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * generateWithFallback(appUrl, userInputs, jinaResult, apiKey, { signal, onModelSwitch })
 * Walks GROQ_MODELS; 429 falls through to the next model, anything else throws.
 */
export async function generateWithFallback(appUrl, userInputs, jinaResult, apiKey, options = {}) {
  const { signal, onModelSwitch } = options;
  let lastError = null;

  for (let i = 0; i < GROQ_MODELS.length; i += 1) {
    const model = GROQ_MODELS[i];
    const isLast = i === GROQ_MODELS.length - 1;
    try {
      return await generateScript(appUrl, userInputs, jinaResult, apiKey, model.id, { signal });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      lastError = err;

      const rateLimited = err instanceof GroqError && err.status === 429;
      if (rateLimited && !isLast) {
        console.warn(`[Keyframe] ${model.id} rate limited — falling back to ${GROQ_MODELS[i + 1].id}`);
        if (typeof onModelSwitch === 'function') onModelSwitch(model.id, GROQ_MODELS[i + 1].id);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new GroqError(500, null);
}

/**
 * validateApiKey(key) — lightweight key probe kept for the dev harness and
 * tests (the Settings key field has been removed now that the app ships with
 * its own bundled key). Sends a 1-token request; returns { valid, error }.
 */
export async function validateApiKey(key) {
  const value = String(key || '').trim();
  if (!value.startsWith('gsk_')) {
    return { valid: false, error: 'A Groq key starts with "gsk_".' };
  }

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODELS[0].id,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        max_tokens: 3,
        temperature: 0,
        stream: false,
      }),
    });

    if (response.ok) return { valid: true }; 
    let body = null;
    try {
      body = await response.json();
    } catch (err) {
      body = null;
    }
    const classified = new GroqError(response.status, body);
    return { valid: false, error: classified.userMsg, type: classified.type };
  } catch (err) {
    return {
      valid: false,
      error: 'Could not reach Groq to validate the key. Check your connection.',
      type: 'OFFLINE',
    };
  }
}

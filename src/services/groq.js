/* ═══════════════════════════════════════════════════════════════════════════
   GROQ — Section 6.5
   Browser → api.groq.com directly. The key is never logged and never sent
   anywhere else (Rule 4).
   ═══════════════════════════════════════════════════════════════════════════ */

import { GroqError, OFFLINE } from './errorClassifier.js';
import { buildFullPrompt } from './promptBuilder.js';
import { parseAndValidateOutput } from './outputParser.js';
import { KF_KEYS, readLS } from '../store/storage.js';

export const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', contextWindow: 128000 }, // primary
  { id: 'llama3-8b-8192', contextWindow: 8192 }, // fallback
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

function trimForModel(jinaResult, model) {
  if (model.contextWindow >= 32000) return jinaResult;
  const trimmed = {
    ...jinaResult,
    cleaned: String(jinaResult.cleaned || '').slice(0, 20000),
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
        max_tokens: 4000,
        response_format: { type: 'json_object' },
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
 * validateApiKey(key) — the lightweight Settings test call.
 * Sends a 1-token request; returns { valid, error }.
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

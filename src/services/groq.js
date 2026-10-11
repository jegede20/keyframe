/* ═══════════════════════════════════════════════════════════════════════════
   GROQ — Section 6.5
   Browser → api.groq.com directly. The key is never logged and never sent
   anywhere else (Rule 4).
   ═══════════════════════════════════════════════════════════════════════════ */

import { GroqError, OFFLINE, TRUNCATED } from './errorClassifier.js';
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

/**
 * resolveApiKey() → the key generation runs with.
 *
 * The key is bundled at build time from VITE_GROQ_API_KEY; people using the app
 * never supply one. The earlier build let a key pasted into Settings win over
 * this one — that path is retired, and the localStorage slot it used is
 * deliberately not read, so a key left behind by an old build can never
 * override the shipped key.
 */
export function resolveApiKey() {
  const envKey = String(import.meta.env.VITE_GROQ_API_KEY || '').trim();
  if (envKey.startsWith('gsk_')) return envKey;

  // A build without the env var is a deployment mistake — no UI can fix it.
  throw new GroqError(401, { error: 'no_api_key' });
}

/**
 * Groq's free tier allows 8,000 tokens per minute per model (RPM 1,000), and the
 * TPM check counts prompt + max_tokens together, so the two budgets compete for
 * one ceiling. A measured run on a real page: 17,905 prompt characters = 5,443
 * tokens, of which ~1,190 were instructions; the completion used 2,988 tokens
 * and 1,372 of those were reasoning tokens — leaving only ~1,600 tokens for a
 * 90-second script, which is why responses occasionally stopped mid-JSON.
 *
 * So the page body gets 9,000 characters (instructions ~3.9k characters ≈ 1.2k
 * tokens, ≈ 3,900 tokens total) and the completion gets 3,600, keeping the pair
 * near 7,500 of the 8,000 ceiling with room for pages that tokenise denser.
 * Both models have 131k context windows, so TPM — not context length — is the
 * binding constraint. Headings survive the trim in full (they drive screen
 * names); only the body prose is shortened.
 */
const PROMPT_CHAR_BUDGET = 9000;

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
        max_tokens: 3600, // ~1.4k of this pays for reasoning; see PROMPT_CHAR_BUDGET
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

  /* A response that hit the ceiling stops mid-JSON. The parser can only see a
     truncated object and would report a missing section, so name the real
     cause here — and do not fall through to the other model: this is not a
     quota problem, and a silent retry would double the token spend. */
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw Object.assign(new Error('Groq response hit the max_tokens ceiling mid-JSON'), TRUNCATED);
  }
  const rawContent = choice?.message?.content;
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

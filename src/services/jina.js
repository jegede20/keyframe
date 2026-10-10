/* ═══════════════════════════════════════════════════════════════════════════
   JINA READER — Section 6.1
   GET https://r.jina.ai/{url} — no API key needed for basic usage.
   The browser talks to Jina directly. No proxy, no server (Rule 3).
   ═══════════════════════════════════════════════════════════════════════════ */

import { JINA_EMPTY, OFFLINE, jinaHttpError } from './errorClassifier.js';

export const JINA_MAX_CHARS = 48000;

/** Adds https:// when the user typed a bare domain. */
export function normalizeUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(value)) return `https://${value}`;
  return value;
}

/** Real-time URL validation used by the URL field. */
export function isValidUrl(rawUrl) {
  const value = normalizeUrl(rawUrl);
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(parsed.hostname);
  } catch (err) {
    return false;
  }
}

/**
 * cleanMarkdown(raw) — the six cleaning passes from the spec, in order.
 */
export function cleanMarkdown(raw) {
  let text = String(raw || '');

  // a. Collapse runs of blank lines to at most two.
  text = text.replace(/\n{3,}/g, '\n\n');

  // b. Cookie / GDPR notices.
  text = text.replace(/we use cookies[\s\S]{0,300}?(accept|agree|ok)/gi, '');

  // c. Deduplicate lines (lines shorter than 10 chars are kept as-is —
  //    they're usually meaningful structure like "## Pricing" or "- Free").
  const seen = new Set();
  text = text
    .split('\n')
    .filter((line) => {
      const key = line.trim();
      if (key.length < 10) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n');

  // d. Social share boilerplate.
  text = text.replace(/share on (twitter|facebook|linkedin|x)/gi, '');

  // e. Anchor-only lines.
  text = text.replace(/^\[.*?\]\(#.*?\)$/gm, '');

  // Tidy up the blank lines the passes above may have introduced.
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  // f. Hard cap for the model's context window.
  if (text.length > JINA_MAX_CHARS) {
    text = `${text.slice(0, JINA_MAX_CHARS)}\n\n[Content truncated]`;
  }

  return text;
}

/** Collects H1–H3 headings — these become candidate "screens". */
export function extractSections(cleaned) {
  const sections = [];
  const regex = /^#{1,3}\s+(.+)$/gm;
  let match = regex.exec(cleaned);
  while (match !== null) {
    const heading = match[1].replace(/#+\s*$/, '').trim();
    if (heading && !sections.includes(heading)) sections.push(heading);
    match = regex.exec(cleaned);
  }
  return sections;
}

/**
 * fetchAndCleanJina(url, { signal })
 * → { cleaned, sections, charCount, estimatedTokens, sourceUrl }
 */
export async function fetchAndCleanJina(url, options = {}) {
  const { signal } = options;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw Object.assign(new Error(OFFLINE.userMsg), OFFLINE);
  }

  const target = normalizeUrl(url);
  let response;
  try {
    response = await fetch(`https://r.jina.ai/${target}`, {
      method: 'GET',
      headers: { Accept: 'text/markdown' },
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    console.warn('[Keyframe] Jina fetch failed:', err);
    throw Object.assign(new Error(OFFLINE.userMsg), OFFLINE);
  }

  if (!response.ok) {
    throw Object.assign(new Error(`Jina HTTP ${response.status}`), jinaHttpError(response.status));
  }

  const raw = await response.text();
  if (!raw || raw.trim().length < 120) {
    throw Object.assign(new Error(JINA_EMPTY.userMsg), JINA_EMPTY);
  }

  const cleaned = cleanMarkdown(raw);
  if (!cleaned || cleaned.length < 120) {
    throw Object.assign(new Error(JINA_EMPTY.userMsg), JINA_EMPTY);
  }

  const sections = extractSections(cleaned);
  const charCount = cleaned.length;

  return {
    cleaned,
    sections,
    charCount,
    estimatedTokens: Math.ceil(charCount / 4),
    sourceUrl: target,
  };
}

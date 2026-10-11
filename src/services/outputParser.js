/* ═══════════════════════════════════════════════════════════════════════════
   OUTPUT PARSER — Section 6.4
   Parse → validate → repair. Never crash on a malformed model response.
   ═══════════════════════════════════════════════════════════════════════════ */

import { PARSE_ERROR, incompleteOutput } from './errorClassifier.js';
import { repairTimings, secondsToTimestamp } from '../utils/timing.js';
import { countWords } from '../utils/wordCount.js';

/* ── videoPrompt length window (300–600 words) ─────────────────────────── */
const VIDEO_PROMPT_MIN = 300;
const VIDEO_PROMPT_MAX = 600;

const DELIVERY_NOTES = [
  '',
  'DELIVERY NOTES',
  '- Aspect: 16:9 master at 1080p; render a 9:16 vertical crop for Shorts, Reels and TikTok.',
  '- Motion: continuous, confident moves — slow pushes and short glides, cut on action.',
  '- Pacing: every UI change resolves before the next one begins; no dead frames.',
  '- Legibility: keep the interface at 100% scale — never shrink the UI to fit two screens at once.',
  '- Text: burn captions from the voiceover lines above, inside the title-safe area.',
  '- Audio: clean voiceover over a restrained electronic bed, with quiet, audible UI clicks.',
];

const PACING_CLOSER = [
  '',
  'Overall rhythm: open on the strongest visual moment, settle into a steady two-to-three',
  'second cut rhythm across the feature screens, then finish on the closing beat with the app',
  'name held on screen for a full second of silence before the cut to black. Keep every',
  'transition in one visual language so the sequence reads as a single continuous take',
  'rather than a stitched reel of separate clips.',
];

/** One line per shot — used only when the model under-delivers on prompt length. */
function shotRundownLines(script) {
  const lines = ['', 'SHOT-BY-SHOT RUNDOWN (match these beats in order)'];
  (script || []).forEach((shot, index) => {
    const number = shot.shotNumber ?? index + 1;
    const label = shot.label || `SHOT ${number}`;
    const beats = [];
    if (shot.screen) beats.push(`on ${shot.screen}`);
    if (shot.action) beats.push(String(shot.action).trim().replace(/\.$/, ''));
    if (shot.narration) beats.push(`Voiceover: “${String(shot.narration).trim()}”`);
    lines.push(
      `${number}. ${shot.timeStart || '0:00'}–${shot.timeEnd || ''} — ${label}: ${beats.join('. ')}.`
    );
  });
  return lines;
}

function padVideoPrompt(text, script, target) {
  const parts = [String(text).trim()];
  const sections = [
    shotRundownLines(script),
    DELIVERY_NOTES,
    PACING_CLOSER,
  ];
  for (const section of sections) {
    for (const line of section) {
      parts.push(line);
      if (countWords(parts.join(' ')) >= VIDEO_PROMPT_MIN) {
        return parts.join('\n');
      }
    }
  }
  return parts.join('\n');
}

function trimToWordBudget(text, budget) {
  const sentences = String(text).match(/[^.!?]+[.!?]+\s*/g) || [String(text)];
  const kept = [];
  let used = 0;
  for (const sentence of sentences) {
    const words = countWords(sentence);
    if (used + words > budget && kept.length) break;
    kept.push(sentence.trim());
    used += words;
    if (used >= budget) break;
  }
  return kept.length ? kept.join(' ') : String(text).trim();
}

const REQUIRED_KEYS = ['meta', 'script', 'cutList', 'videoPrompt'];
const REQUIRED_SHOT_FIELDS = [
  'shotNumber',
  'screen',
  'timeStart',
  'timeEnd',
  'durationSeconds',
  'action',
  'narration',
];

/** Strips ```json fences and any prose wrapped around the object. */
function stripFences(raw) {
  let text = String(raw ?? '').trim();
  text = text.replace(/^```(?:json|JSON)?\s*/i, '').replace(/```\s*$/, '');
  text = text.trim();
  if (text.startsWith('{') && text.endsWith('}')) return text;

  // Fall back to the outermost balanced braces.
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) return text.slice(first, last + 1);
  return text;
}

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * parseAndValidateOutput(rawContent) → validated output object
 */
export function parseAndValidateOutput(rawContent) {
  /* Step 1 — parse (with a fence-stripping retry) */
  let parsed = tryParse(String(rawContent ?? '').trim());
  if (!parsed) {
    parsed = tryParse(stripFences(rawContent));
  }
  if (!parsed || !isPlainObject(parsed)) {
    throw Object.assign(new Error(PARSE_ERROR.userMsg), PARSE_ERROR);
  }

  /* Step 2 — required top-level keys */
  for (const key of REQUIRED_KEYS) {
    if (!(key in parsed)) {
      throw Object.assign(new Error(`AI output missing required section: "${key}"`), incompleteOutput(key));
    }
  }

  /* meta — fill gaps rather than fail */
  if (!isPlainObject(parsed.meta)) parsed.meta = {};
  const meta = parsed.meta;

  /* Step 3 — script must be a non-empty array */
  if (!Array.isArray(parsed.script) || parsed.script.length === 0) {
    throw Object.assign(new Error('AI output missing required section: "script" (empty script)'), incompleteOutput('script'));
  }

  /* Step 4 — shot fields, with placeholders instead of crashes */
  const warnings = [];
  parsed.script = parsed.script.map((shot, index) => {
    const safe = isPlainObject(shot) ? { ...shot } : {};
    const missing = REQUIRED_SHOT_FIELDS.filter(
      (field) => safe[field] === undefined || safe[field] === null || safe[field] === ''
    );

    if (missing.length) {
      warnings.push(`Shot ${index + 1} missing: ${missing.join(', ')} — placeholders injected.`);
      const placeholders = {
        shotNumber: index + 1,
        screen: 'Unnamed screen',
        timeStart: '0:00',
        timeEnd: '0:00',
        durationSeconds: 5,
        action: 'Hold on the interface — no specific direction returned.',
        narration: '',
      };
      missing.forEach((field) => {
        safe[field] = placeholders[field];
      });
    }

    // Coerce numerics and strings defensively.
    safe.shotNumber = Number(safe.shotNumber) || index + 1;
    safe.durationSeconds = Math.max(1, Math.round(Number(safe.durationSeconds) || 5));
    safe.screen = String(safe.screen);
    safe.action = String(safe.action);
    safe.narration = String(safe.narration);
    safe.label =
      typeof safe.label === 'string' && safe.label.trim()
        ? safe.label.trim().toUpperCase()
        : index === 0
          ? 'OPENING'
          : index === parsed.script.length - 1
            ? 'CLOSING'
            : `FEATURE ${index}`;
    safe.timeStart = String(safe.timeStart);
    safe.timeEnd = String(safe.timeEnd);
    return safe;
  });

  /* meta defaults derived from the script itself */
  if (!meta.appName || typeof meta.appName !== 'string') {
    meta.appName = inferAppName(parsed) || 'Your app';
  }
  if (!meta.appPurpose || typeof meta.appPurpose !== 'string') {
    meta.appPurpose = 'Product demo walkthrough.';
  }
  if (!Number(meta.totalSeconds)) {
    meta.totalSeconds = parsed.script.reduce(
      (sum, shot) => sum + (Number(shot.durationSeconds) || 0),
      0
    );
  }
  meta.totalSeconds = Math.max(1, Math.round(Number(meta.totalSeconds)));
  meta.shotCount = parsed.script.length;
  if (!Number(meta.estimatedWordCount)) {
    meta.estimatedWordCount = parsed.script.reduce(
      (sum, shot) => sum + countWords(shot.narration),
      0
    );
  }
  if (!meta.tone || typeof meta.tone !== 'string') meta.tone = 'professional';

  /* Step 5 — timing repair (the guarantee: sum === totalSeconds) */
  parsed.script = repairTimings(parsed.script, meta.totalSeconds);
  meta.shotCount = parsed.script.length;
  meta.estimatedWordCount = parsed.script.reduce(
    (sum, shot) => sum + countWords(shot.narration),
    0
  );
  // Final shot must end exactly on the total.
  const lastShot = parsed.script[parsed.script.length - 1];
  lastShot.timeEnd = secondsToTimestamp(meta.totalSeconds);
  lastShot.durationSeconds = Math.max(
    1,
    meta.totalSeconds -
      (parsed.script.length > 1
        ? parsed.script
            .slice(0, -1)
            .reduce((sum, shot) => sum + shot.durationSeconds, 0)
        : 0)
  );
  parsed.script = repairTimings(parsed.script, meta.totalSeconds);

  /* Step 6 — cutList must be an array */
  if (!Array.isArray(parsed.cutList)) {
    warnings.push('cutList was not an array — defaulted to [].');
    parsed.cutList = [];
  }
  parsed.cutList = parsed.cutList
    .filter((item) => isPlainObject(item))
    .map((item, index) => ({
      screenName: String(item.screenName || `Excluded screen ${index + 1}`),
      reason: String(item.reason || 'Not enough screen time to cover it well.'),
    }));

  /* Step 7 — videoPrompt.fullPrompt must exist */
  if (!isPlainObject(parsed.videoPrompt)) {
    warnings.push('videoPrompt was malformed — rebuilt from defaults.');
    parsed.videoPrompt = {};
  }
  parsed.videoPrompt.target =
    typeof parsed.videoPrompt.target === 'string' && parsed.videoPrompt.target
      ? parsed.videoPrompt.target
      : 'any';
  if (
    typeof parsed.videoPrompt.fullPrompt !== 'string' ||
    parsed.videoPrompt.fullPrompt.trim().length < 40
  ) {
    warnings.push('videoPrompt.fullPrompt missing or too short — placeholder inserted.');
    parsed.videoPrompt.fullPrompt =
      'ERROR: the AI did not return a usable video prompt for this generation. Regenerate the script, or copy the shot list above straight into your editor.';
  }

  /* Step 7b — hold the prompt inside the 300–600 word window */
  const promptMissing = parsed.videoPrompt.fullPrompt.startsWith('ERROR:');
  if (!promptMissing) {
    const promptWords = countWords(parsed.videoPrompt.fullPrompt);
    if (promptWords < VIDEO_PROMPT_MIN) {
      parsed.videoPrompt.fullPrompt = padVideoPrompt(
        parsed.videoPrompt.fullPrompt,
        parsed.script,
        parsed.videoPrompt.target
      );
      warnings.push(
        `videoPrompt was ${promptWords} words — a shot rundown and delivery notes were appended to reach the ${VIDEO_PROMPT_MIN}-word minimum.`
      );
    } else if (promptWords > VIDEO_PROMPT_MAX) {
      parsed.videoPrompt.fullPrompt = trimToWordBudget(parsed.videoPrompt.fullPrompt, VIDEO_PROMPT_MAX);
      warnings.push(
        `videoPrompt was ${promptWords} words — trimmed to the ${VIDEO_PROMPT_MAX}-word limit at a sentence boundary.`
      );
    }
  }

  /* Step 8 — hand back the validated object */
  if (warnings.length) {
    console.warn('[Keyframe] Output warnings:\n' + warnings.join('\n'));
  }
  parsed.__warnings = warnings;

  return parsed;
}

function inferAppName(parsed) {
  const firstShot = parsed?.script?.[0];
  if (firstShot && typeof firstShot.title === 'string') return firstShot.title;
  return '';
}

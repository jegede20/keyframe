/* ═══════════════════════════════════════════════════════════════════════════
   DEV-ONLY CONSOLE TEST HARNESS — Step 33
   Loaded only in dev (import.meta.env.DEV) so it never ships in the bundle.
   Usage in the browser console:
     __keyframeTest.all()                       // offline suite (no key needed)
     __keyframeTest.jina('https://tailwindcss.com')
     __keyframeTest.groq('gsk_...', 90)         // live generation checks
     __keyframeTest.groq('gsk_...', 60, 'energetic')
   ═══════════════════════════════════════════════════════════════════════════ */

import { fetchAndCleanJina, isValidUrl, cleanMarkdown } from '../services/jina.js';
import { buildFullPrompt } from '../services/promptBuilder.js';
import { parseAndValidateOutput } from '../services/outputParser.js';
import { GroqError, classifyGroqStatus } from '../services/errorClassifier.js';
import { generateWithFallback } from '../services/groq.js';
import { secondsToTimestamp, repairTimings, sumDurations } from '../utils/timing.js';
import { countWords, maxWordsForDuration, scriptWordStats } from '../utils/wordCount.js';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  const line = `${name}${detail ? ` — ${detail}` : ''}`;
  if (condition) {
    passed += 1;
    console.log(`%c✅ ${line}`, 'color:#00E5A0');
  } else {
    failed += 1;
    console.error(`❌ ${line}`);
  }
}

function report(label) {
  console.log(
    `%c── ${label}: ${passed} passed, ${failed} failed ──`,
    `font-weight:bold;color:${failed ? '#FF6B6B' : '#6C5CE7'}`
  );
  const out = { passed, failed };
  passed = 0;
  failed = 0;
  return out;
}

function offlineSuite() {
  console.log('%cKeyframe · Phase 3 offline suite', 'font-weight:bold;font-size:13px');

  // URL validation
  check('valid bare domain', isValidUrl('stripe.com'));
  check('invalid url rejected', !isValidUrl('not a url'));

  // Cleaner
  const dirty = '# A\n\n\n\nWe use cookies and by continuing you accept.\nShare on Twitter\n## Real-time analytics dashboard for teams\n## Real-time analytics dashboard for teams\n' + 'y'.repeat(50000);
  const clean = cleanMarkdown(dirty);
  check('cookie notice stripped', !/cookies/i.test(clean));
  check('social share stripped', !/share on twitter/i.test(clean));
  check('duplicate long lines deduped', (clean.match(/Real-time analytics dashboard/g) || []).length === 1);
  check('48k cap applied', clean.length <= 48000 + 21, `${clean.length} chars`);

  // Timing
  check('0 → 0:00', secondsToTimestamp(0) === '0:00');
  check('95 → 1:35', secondsToTimestamp(95) === '1:35');
  const fixed = repairTimings([{ durationSeconds: 10 }, { durationSeconds: 10 }, { durationSeconds: 10 }], 90);
  check('repairTimings sums to total', sumDurations(fixed) === 90, `sum=${sumDurations(fixed)}`);
  check('last shot ends on total', fixed.at(-1).timeEnd === '1:30');

  // Speaking rate
  check('130wpm: 10s → 21 words', maxWordsForDuration(10) === 21);
  check('stage directions excluded', countWords('(click Export) Export now') === 2);

  // Parser repair paths
  const repaired = parseAndValidateOutput(
    JSON.stringify({
      meta: { totalSeconds: 60 },
      script: [{ shotNumber: 1 }, { shotNumber: 2 }],
      cutList: 'nope',
      videoPrompt: {},
    })
  );
  check('placeholders injected, no crash', typeof repaired.script[0].narration === 'string');
  check('cutList defaulted to []', Array.isArray(repaired.cutList));
  check('videoPrompt placeholder', /^ERROR:/.test(repaired.videoPrompt.fullPrompt));
  check('timings repaired to 60', sumDurations(repaired.script) === 60);

  // Error classification
  check('401 classified', new GroqError(401, null).type === 'INVALID_API_KEY');
  check('429 classified', new GroqError(429, null).type === 'RATE_LIMITED');
  check('503 classified', new GroqError(503, null).type === 'GROQ_DOWN');
  check('400 classified', classifyGroqStatus(400).action === 'EDIT_INPUTS');

  return report('offline suite');
}

async function jinaSuite(url = 'https://tailwindcss.com/') {
  console.log(`%cKeyframe · Jina read: ${url}`, 'font-weight:bold;font-size:13px');
  const res = await fetchAndCleanJina(url);
  check('cleaned content returned', res.charCount > 200, `${res.charCount} chars`);
  check('sections extracted', res.sections.length > 0, `${res.sections.length} headings`);
  check('token estimate ≈ chars/4', res.estimatedTokens === Math.ceil(res.charCount / 4));
  const built = buildFullPrompt(url, { features: 'x', length: 90, tone: 'professional', videoTool: 'any' }, res);
  check('prompt layers assembled', built.messages.length === 2 && built.messages[1].content.includes('=== BRIEF ==='));
  console.log(res);
  return report('jina suite');
}

async function groqSuite(apiKey, length = 90, tone = 'professional') {
  console.log(`%cKeyframe · live Groq generation (${length}s, ${tone})`, 'font-weight:bold;font-size:13px');
  const jina = await fetchAndCleanJina('https://tailwindcss.com/');
  const res = await generateWithFallback(
    'https://tailwindcss.com/',
    { features: 'Dashboards, search, components', length, tone, videoTool: 'any' },
    jina,
    apiKey
  );
  const shots = res.output.script;
  const stats = scriptWordStats(shots);
  check('shot count in spec range', shots.length >= (length === 30 ? 3 : length === 60 ? 5 : length === 90 ? 7 : 9), `${shots.length} shots`);
  check('durations sum exactly', sumDurations(shots) === length, `sum=${sumDurations(shots)}`);
  check('starts at 0:00', shots[0].timeStart === '0:00');
  check('ends exactly on total', shots.at(-1).timeEnd === secondsToTimestamp(length), shots.at(-1).timeEnd);
  check('every narration fits 130wpm', stats.overflowing.length === 0, stats.overflowing.map((o) => `shot ${o.shotNumber} ${o.words}/${o.max}w`).join(', '));
  check('cut list 2–8 items', res.output.cutList.length >= 2 && res.output.cutList.length <= 8, `${res.output.cutList.length}`);
  check('video prompt substantial', countWords(res.output.videoPrompt.fullPrompt) >= 250, `${countWords(res.output.videoPrompt.fullPrompt)} words`);
  check('no filler opener', !/(in this video|welcome to)/i.test(shots[0].narration));
  check('model reported', Boolean(res.model), res.model);
  console.log(res.output);
  return report('groq suite');
}

export function install() {
  const api = {
    all: async () => {
      offlineSuite();
      await jinaSuite();
      return 'Offline + Jina suites complete. Pass a key to __keyframeTest.groq().';
    },
    offline: offlineSuite,
    jina: jinaSuite,
    groq: groqSuite,
  };
  window.__keyframeTest = api;
  console.log(
    '%c▶ Keyframe dev harness ready%c — try __keyframeTest.all() or __keyframeTest.groq("gsk_…", 90)',
    'color:#6C5CE7;font-weight:bold;font-size:13px',
    'color:#9494A8'
  );
}

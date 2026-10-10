/* ═══════════════════════════════════════════════════════════════════════════
   PROMPT BUILDER — Section 6.3 (4 layers)
   Layer 1: SYSTEM_PROMPT · Layer 2: buildContextLayer
   Layer 3: buildParametersLayer · Layer 4: OUTPUT_SCHEMA
   ═══════════════════════════════════════════════════════════════════════════ */

import { getShotRange } from '../utils/timing.js';

/* ── Layer 1 — static system prompt ─────────────────────────────────────── */
export const SYSTEM_PROMPT = `You are Keyframe, an expert product demo scriptwriter and video director.
You have deep experience writing scripts for SaaS product demos, app walkthroughs,
and feature highlight videos. You think like a director: you know what to show,
what to skip, and exactly how long each shot should last.

NEVER BREAK THESE RULES:
1. ONLY reference screens/pages found in the scraped content. Never invent screens.
2. Shot timings must be mathematically precise. First shot starts at 0:00. Last shot
   ends at exactly the requested total duration. No gaps. No overlaps.
3. Shot count must match duration:
   30s → 3–4 shots | 60s → 5–7 shots | 90s → 7–9 shots | 120s → 9–12 shots
4. Narrator lines must be speakable in the shot's time window.
   Human speech = 130 words/minute. A 10-second shot = max ~22 words.
5. Cut list must contain ONLY screens from the scraped content that were considered
   but excluded. Minimum 2 items, maximum 8. Each reason must be specific.
6. NEVER use filler phrases like "In this video we will..." or "Welcome to our demo."
   Start the script with immediate value.
7. The video creation prompt must be self-contained. 300–600 words.
8. Return ONLY valid JSON. Start with { and end with }. No markdown, no explanation.`;

/* ── Tone guides ───────────────────────────────────────────────────────── */
export const TONE_GUIDES = {
  professional:
    "Authoritative, clear, confident. Business-appropriate. No slang. Example: 'The dashboard gives your team a complete view of every project in flight.'",
  casual:
    "Friendly, warm, conversational. Everyday words. Light. Example: 'And this is where all the magic happens — your main dashboard.'",
  energetic:
    'Exciting, fast, punchy. Short sentences. Power words. Action-forward. Example: \'One click. New project. Done.\'',
  technical:
    "Precise, detailed, feature-focused. Technical terms welcome. Example: 'The API integration layer supports OAuth 2.0 and webhook-based event streaming.'",
};

/* ── Video tool guides ─────────────────────────────────────────────────── */
export const VIDEO_TOOL_GUIDES = {
  any: 'Use plain language for scene descriptions. Works universally.',
  runway:
    'Camera movement first, then scene, then style. Use: slow zoom, pan left, static shot, dolly in.',
  pika: 'Under 200 chars per scene. Format: [camera motion] [scene] [style].',
  heygen: 'Teleprompter-ready. Include [PAUSE], [EMPHASIS], [GESTURE] markers.',
  synthesia:
    "Slide-by-slide with [SLIDE X] markers. Include 'Screen share:' per scene.",
  capcut: 'Short, punchy. Include [CUT] and [TRANSITION] beat markers.',
};

export const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'technical', label: 'Technical' },
];

export const VIDEO_TOOL_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'runway', label: 'Runway' },
  { value: 'pika', label: 'Pika' },
  { value: 'heygen', label: 'HeyGen' },
  { value: 'synthesia', label: 'Synthesia' },
  { value: 'capcut', label: 'CapCut' },
];

export const LENGTH_OPTIONS = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '60 seconds' },
  { value: 90, label: '90 seconds' },
  { value: 120, label: '120 seconds' },
];

/* ── Layer 2 — scraped context ─────────────────────────────────────────── */
export function buildContextLayer(jinaResult, appUrl) {
  const sections = jinaResult?.sections?.length
    ? jinaResult.sections.join(', ')
    : '(none detected — infer screens from the content itself)';

  return `=== APP CONTENT (Scraped from ${appUrl}) ===
Estimated tokens: ${jinaResult?.estimatedTokens ?? 0}
Detected sections/screens: ${sections}
--- BEGIN SCRAPED CONTENT ---
${jinaResult?.cleaned ?? ''}
--- END SCRAPED CONTENT ---
Based ONLY on the content above, identify the app's name, purpose, all distinct
screens, main user actions, and key features. Use this to inform your script.`;
}

/* ── Layer 3 — user parameters ─────────────────────────────────────────── */
export function buildParametersLayer(userInputs = {}) {
  const {
    features = '',
    length = 90,
    tone = 'professional',
    videoTool = 'any',
    requiredScreens = [],
    extraInstruction = '',
  } = userInputs;

  const featureText = String(features || '').trim()
    ? String(features).trim()
    : 'No specific features listed — choose the most compelling capabilities found in the scraped content and rank them by demo value.';

  const toneGuide = TONE_GUIDES[tone] || TONE_GUIDES.professional;
  const toolGuide = VIDEO_TOOL_GUIDES[videoTool] || VIDEO_TOOL_GUIDES.any;

  const requiredBlock = requiredScreens.length
    ? `\n- MUST INCLUDE THESE SCREENS (the user added them back from the cut list): ${requiredScreens.join(', ')}`
    : '';

  const extraBlock = extraInstruction ? `\n- ADDITIONAL DIRECTION: ${extraInstruction}` : '';

  return `=== BRIEF ===
- FEATURES TO HIGHLIGHT: ${featureText}
- SCRIPT LENGTH: ${length} seconds total
- REQUIRED SHOT RANGE: ${getShotRange(length)}
- TONE: ${tone} — ${toneGuide}
- VIDEO TOOL TARGET: ${videoTool} — ${toolGuide}${requiredBlock}${extraBlock}`;
}

/* ── Layer 4 — output contract ─────────────────────────────────────────── */
export const OUTPUT_SCHEMA = `=== OUTPUT FORMAT ===
Return ONLY a single valid JSON object — no markdown fences, no commentary.
Start with { and end with }. Exact structure:

{
  "meta": {
    "appName": "string",
    "appPurpose": "string — 1 sentence",
    "totalSeconds": number,
    "shotCount": number,
    "estimatedWordCount": number,
    "tone": "string"
  },
  "script": [
    {
      "shotNumber": number,
      "label": "string — OPENING | FEATURE N | CLOSING — uppercase",
      "screen": "string — exact screen name from app content",
      "timeStart": "string — M:SS",
      "timeEnd": "string — M:SS",
      "durationSeconds": number,
      "action": "string — precise director instruction (specific, not vague)",
      "narration": "string — spoken words only, no stage directions"
    }
  ],
  "cutList": [
    {
      "screenName": "string",
      "reason": "string — 1–3 sentences, specific to this screen"
    }
  ],
  "videoPrompt": {
    "target": "string",
    "fullPrompt": "string — 300–600 words, fully self-contained"
  }
}

FINAL CHECKS BEFORE YOU ANSWER:
- durationSeconds values sum to exactly the requested total.
- timeStart of shot 1 is "0:00"; timeEnd of the final shot equals the total as M:SS.
- Narration word counts obey 130 words/minute for each shot.
- cutList length is between 2 and 8 and every screenName exists in the scraped content.
- No invented screens, no filler opening lines, valid JSON only.`;

/**
 * buildFullPrompt(appUrl, userInputs, jinaResult)
 * → { messages: [system, user], meta }
 */
export function buildFullPrompt(appUrl, userInputs, jinaResult) {
  const contextLayer = buildContextLayer(jinaResult, appUrl);
  const parametersLayer = buildParametersLayer(userInputs);

  const userContent = `${contextLayer}

${parametersLayer}

${OUTPUT_SCHEMA}`;

  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    meta: {
      systemChars: SYSTEM_PROMPT.length,
      userChars: userContent.length,
    },
  };
}

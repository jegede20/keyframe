var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/services/errorClassifier.js
var errorClassifier_exports = {};
__export(errorClassifier_exports, {
  ABORT_ERROR: () => ABORT_ERROR,
  GroqError: () => GroqError,
  JINA_EMPTY: () => JINA_EMPTY,
  OFFLINE: () => OFFLINE,
  PARSE_ERROR: () => PARSE_ERROR,
  URL_ERROR: () => URL_ERROR,
  classifyGroqStatus: () => classifyGroqStatus,
  jinaHttpError: () => jinaHttpError,
  normalizeError: () => normalizeError
});
function classifyGroqStatus(status, body) {
  const detail = body && (body.error?.message || body.message || body.detail) || "";
  switch (status) {
    case 401:
      return {
        type: "INVALID_API_KEY",
        title: "AI key rejected",
        userMsg: "Keyframe's built-in Groq key was rejected by the API.",
        suggestion: "Nothing to re-enter \u2014 this is service-side. Try again in a moment.",
        action: "RETRY"
      };
    case 429:
      return {
        type: "RATE_LIMITED",
        title: "Rate limit reached",
        userMsg: "Keyframe's shared Groq quota is used up for this minute.",
        suggestion: detail || "It refills every 60 seconds \u2014 give it a few moments, then generate again.",
        action: "RETRY"
      };
    case 503:
      return {
        type: "GROQ_DOWN",
        title: "Groq is unavailable",
        userMsg: "Groq's servers are temporarily unavailable. This usually resolves in a few minutes.",
        suggestion: "Try again in a minute \u2014 your inputs are safe.",
        action: "RETRY"
      };
    case 400:
      return {
        type: "BAD_REQUEST",
        title: "Could not process that input",
        userMsg: "The AI couldn't process this input. Try simplifying your features list.",
        suggestion: detail || "Shorter feature lists (a few key lines) work best.",
        action: "EDIT_INPUTS"
      };
    case 413:
      return {
        type: "TOO_LARGE",
        title: "Context too large",
        userMsg: "The app page was too big to send whole. Try a shorter landing page.",
        suggestion: "A marketing or pricing page usually reads cleaner than a docs site.",
        action: "EDIT_INPUTS"
      };
    default:
      return {
        type: "UNKNOWN",
        title: "Something went wrong",
        userMsg: "Something went wrong. Please try again.",
        suggestion: detail || null,
        action: "RETRY"
      };
  }
}
function normalizeError(error) {
  if (!error) {
    return {
      type: "UNKNOWN",
      title: "Something went wrong",
      userMsg: "Something went wrong. Please try again.",
      suggestion: null,
      action: "RETRY",
      raw: null
    };
  }
  if (error instanceof GroqError) {
    return {
      type: error.type,
      title: error.title,
      userMsg: error.userMsg,
      suggestion: error.suggestion,
      action: error.action,
      status: error.status,
      raw: error
    };
  }
  if (error.type && error.userMsg) {
    return { ...error, raw: error };
  }
  if (error.name === "AbortError") {
    return { ...ABORT_ERROR, raw: error };
  }
  if (error.name === "TypeError" && /fetch/i.test(error.message || "")) {
    return {
      ...OFFLINE,
      suggestion: "The request never reached the network. Check your connection.",
      raw: error
    };
  }
  return {
    type: "UNKNOWN",
    title: "Something went wrong",
    userMsg: error.message || "Something went wrong. Please try again.",
    suggestion: null,
    action: "RETRY",
    raw: error
  };
}
function jinaHttpError(status) {
  return {
    type: "JINA_HTTP",
    title: "Could not read that page",
    userMsg: `The reader returned an error (HTTP ${status}). The site may block automated reading.`,
    suggestion: "Try a different public page from the same app.",
    action: "EDIT_INPUTS",
    status
  };
}
var GroqError, JINA_EMPTY, OFFLINE, URL_ERROR, PARSE_ERROR, ABORT_ERROR;
var init_errorClassifier = __esm({
  "src/services/errorClassifier.js"() {
    GroqError = class extends Error {
      constructor(status, body) {
        const info = classifyGroqStatus(status, body);
        super(info.userMsg);
        this.name = "GroqError";
        this.status = status;
        this.type = info.type;
        this.title = info.title;
        this.userMsg = info.userMsg;
        this.suggestion = info.suggestion;
        this.action = info.action;
        this.body = body || null;
      }
    };
    JINA_EMPTY = {
      type: "JINA_EMPTY",
      title: "Couldn't read that URL",
      userMsg: "We couldn't read that URL. The site may be behind a login or heavily JS-gated.",
      suggestion: "Try pasting a public landing or marketing page URL.",
      action: "EDIT_INPUTS"
    };
    OFFLINE = {
      type: "OFFLINE",
      title: "You're offline",
      userMsg: "You appear to be offline. Keyframe needs an internet connection.",
      suggestion: "Reconnect and Keyframe will pick up right where you left off.",
      action: "RETRY_ONLINE"
    };
    URL_ERROR = {
      type: "URL_ERROR",
      title: "That URL looks wrong",
      userMsg: "That doesn't look like a valid web address.",
      suggestion: "Include the full address, e.g. https://yourapp.com.",
      action: "EDIT_INPUTS"
    };
    PARSE_ERROR = {
      type: "PARSE_ERROR",
      title: "Unreadable AI response",
      userMsg: "AI returned unparseable output. Please try again.",
      suggestion: "Regenerating usually fixes this \u2014 the model occasionally returns malformed JSON.",
      action: "RETRY"
    };
    ABORT_ERROR = {
      type: "ABORTED",
      title: "Generation cancelled",
      userMsg: "Generation was cancelled.",
      suggestion: null,
      action: "RETRY"
    };
  }
});

// src/services/jina.js
var jina_exports = {};
__export(jina_exports, {
  JINA_MAX_CHARS: () => JINA_MAX_CHARS,
  cleanMarkdown: () => cleanMarkdown,
  extractSections: () => extractSections,
  fetchAndCleanJina: () => fetchAndCleanJina,
  isValidUrl: () => isValidUrl,
  normalizeUrl: () => normalizeUrl
});
function normalizeUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(value)) return `https://${value}`;
  return value;
}
function isValidUrl(rawUrl) {
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
function cleanMarkdown(raw) {
  let text = String(raw || "");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/we use cookies[\s\S]{0,300}?(accept|agree|ok)/gi, "");
  const seen = /* @__PURE__ */ new Set();
  text = text.split("\n").filter((line) => {
    const key = line.trim();
    if (key.length < 10) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join("\n");
  text = text.replace(/share on (twitter|facebook|linkedin|x)/gi, "");
  text = text.replace(/^\[.*?\]\(#.*?\)$/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  if (text.length > JINA_MAX_CHARS) {
    text = `${text.slice(0, JINA_MAX_CHARS)}

[Content truncated]`;
  }
  return text;
}
function extractSections(cleaned) {
  const sections = [];
  const regex = /^#{1,3}\s+(.+)$/gm;
  let match = regex.exec(cleaned);
  while (match !== null) {
    const heading = match[1].replace(/#+\s*$/, "").trim();
    if (heading && !sections.includes(heading)) sections.push(heading);
    match = regex.exec(cleaned);
  }
  return sections;
}
async function fetchAndCleanJina(url, options = {}) {
  const { signal } = options;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw Object.assign(new Error(OFFLINE.userMsg), OFFLINE);
  }
  const target = normalizeUrl(url);
  let response;
  try {
    response = await fetch(`https://r.jina.ai/${target}`, {
      method: "GET",
      headers: { Accept: "text/markdown" },
      signal
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    console.warn("[Keyframe] Jina fetch failed:", err);
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
    sourceUrl: target
  };
}
var JINA_MAX_CHARS;
var init_jina = __esm({
  "src/services/jina.js"() {
    init_errorClassifier();
    JINA_MAX_CHARS = 48e3;
  }
});

// src/utils/timing.js
var timing_exports = {};
__export(timing_exports, {
  SHOT_RANGES: () => SHOT_RANGES,
  formatDuration: () => formatDuration,
  getShotBounds: () => getShotBounds,
  getShotRange: () => getShotRange,
  recalculateTimestamps: () => recalculateTimestamps,
  repairTimings: () => repairTimings,
  secondsToTimestamp: () => secondsToTimestamp,
  sumDurations: () => sumDurations,
  timestampToSeconds: () => timestampToSeconds
});
function secondsToTimestamp(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
function timestampToSeconds(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?s?$/.test(trimmed)) return Math.round(parseFloat(trimmed));
  const match = trimmed.match(/^(\d+):([0-5]?\d)$/);
  if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  return null;
}
function sumDurations(shots) {
  return (shots || []).reduce(
    (total, shot) => total + (Number(shot?.durationSeconds) || 0),
    0
  );
}
function repairTimings(shots, totalSeconds) {
  const list = Array.isArray(shots) ? shots.map((s) => ({ ...s })) : [];
  if (list.length === 0) return list;
  const target = Math.max(1, Math.round(Number(totalSeconds) || 0));
  const currentSum = sumDurations(list);
  if (currentSum === target) {
    return recalculateTimestamps(list);
  }
  if (currentSum === 0) {
    const base = Math.floor(target / list.length);
    const remainder = target - base * list.length;
    list.forEach((shot, i) => {
      shot.durationSeconds = base + (i === list.length - 1 ? remainder : 0);
    });
    return recalculateTimestamps(list);
  }
  const ratio = target / currentSum;
  list.forEach((shot) => {
    shot.durationSeconds = Math.max(
      1,
      Math.round((Number(shot.durationSeconds) || 1) * ratio)
    );
  });
  let drift = target - sumDurations(list);
  if (drift !== 0) {
    const perShot = Math.trunc(drift / list.length);
    if (perShot !== 0) {
      list.forEach((shot) => {
        shot.durationSeconds = Math.max(1, shot.durationSeconds + perShot);
      });
      drift = target - sumDurations(list);
    }
    const last = list[list.length - 1];
    last.durationSeconds = Math.max(1, last.durationSeconds + drift);
  }
  let finalDrift = target - sumDurations(list);
  if (finalDrift !== 0) {
    let biggest = 0;
    list.forEach((shot, i) => {
      if (shot.durationSeconds > list[biggest].durationSeconds) biggest = i;
    });
    list[biggest].durationSeconds = Math.max(1, list[biggest].durationSeconds + finalDrift);
    finalDrift = target - sumDurations(list);
    if (finalDrift !== 0) {
      list[list.length - 1].durationSeconds = Math.max(
        1,
        list[list.length - 1].durationSeconds + finalDrift
      );
    }
  }
  return recalculateTimestamps(list);
}
function recalculateTimestamps(shots) {
  let cursor = 0;
  return (shots || []).map((shot, index) => {
    const duration = Math.max(1, Math.round(Number(shot.durationSeconds) || 1));
    const timeStart = secondsToTimestamp(cursor);
    const timeEnd = secondsToTimestamp(cursor + duration);
    cursor += duration;
    return {
      ...shot,
      shotNumber: Number(shot.shotNumber) || index + 1,
      durationSeconds: duration,
      timeStart,
      timeEnd
    };
  });
}
function getShotRange(length) {
  return SHOT_RANGES[length] || SHOT_RANGES[90];
}
function getShotBounds(length) {
  const map = {
    30: [3, 4],
    60: [5, 7],
    90: [7, 9],
    120: [9, 12]
  };
  return map[length] || map[90];
}
function formatDuration(seconds) {
  const total = Math.round(Number(seconds) || 0);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}
var SHOT_RANGES;
var init_timing = __esm({
  "src/utils/timing.js"() {
    SHOT_RANGES = {
      30: "3\u20134 shots",
      60: "5\u20137 shots",
      90: "7\u20139 shots",
      120: "9\u201312 shots"
    };
  }
});

// src/services/promptBuilder.js
var promptBuilder_exports = {};
__export(promptBuilder_exports, {
  LENGTH_OPTIONS: () => LENGTH_OPTIONS,
  OUTPUT_SCHEMA: () => OUTPUT_SCHEMA,
  SYSTEM_PROMPT: () => SYSTEM_PROMPT,
  TONE_GUIDES: () => TONE_GUIDES,
  TONE_OPTIONS: () => TONE_OPTIONS,
  VIDEO_TOOL_GUIDES: () => VIDEO_TOOL_GUIDES,
  VIDEO_TOOL_OPTIONS: () => VIDEO_TOOL_OPTIONS,
  buildContextLayer: () => buildContextLayer,
  buildFullPrompt: () => buildFullPrompt,
  buildParametersLayer: () => buildParametersLayer
});
function buildContextLayer(jinaResult2, appUrl) {
  const sections = jinaResult2?.sections?.length ? jinaResult2.sections.join(", ") : "(none detected \u2014 infer screens from the content itself)";
  return `=== APP CONTENT (Scraped from ${appUrl}) ===
Estimated tokens: ${jinaResult2?.estimatedTokens ?? 0}
Detected sections/screens: ${sections}
--- BEGIN SCRAPED CONTENT ---
${jinaResult2?.cleaned ?? ""}
--- END SCRAPED CONTENT ---
Based ONLY on the content above, identify the app's name, purpose, all distinct
screens, main user actions, and key features. Use this to inform your script.`;
}
function buildParametersLayer(userInputs = {}) {
  const {
    features = "",
    length = 90,
    tone = "professional",
    videoTool = "any",
    requiredScreens = [],
    extraInstruction = ""
  } = userInputs;
  const featureText = String(features || "").trim() ? String(features).trim() : "No specific features listed \u2014 choose the most compelling capabilities found in the scraped content and rank them by demo value.";
  const toneGuide = TONE_GUIDES[tone] || TONE_GUIDES.professional;
  const toolGuide = VIDEO_TOOL_GUIDES[videoTool] || VIDEO_TOOL_GUIDES.any;
  const requiredBlock = requiredScreens.length ? `
- MUST INCLUDE THESE SCREENS (the user added them back from the cut list): ${requiredScreens.join(", ")}` : "";
  const extraBlock = extraInstruction ? `
- ADDITIONAL DIRECTION: ${extraInstruction}` : "";
  return `=== BRIEF ===
- FEATURES TO HIGHLIGHT: ${featureText}
- SCRIPT LENGTH: ${length} seconds total
- REQUIRED SHOT RANGE: ${getShotRange(length)}
- TONE: ${tone} \u2014 ${toneGuide}
- VIDEO TOOL TARGET: ${videoTool} \u2014 ${toolGuide}${requiredBlock}${extraBlock}`;
}
function buildFullPrompt(appUrl, userInputs, jinaResult2) {
  const contextLayer = buildContextLayer(jinaResult2, appUrl);
  const parametersLayer = buildParametersLayer(userInputs);
  const userContent = `${contextLayer}

${parametersLayer}

${OUTPUT_SCHEMA}`;
  return {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent }
    ],
    meta: {
      systemChars: SYSTEM_PROMPT.length,
      userChars: userContent.length
    }
  };
}
var SYSTEM_PROMPT, TONE_GUIDES, VIDEO_TOOL_GUIDES, TONE_OPTIONS, VIDEO_TOOL_OPTIONS, LENGTH_OPTIONS, OUTPUT_SCHEMA;
var init_promptBuilder = __esm({
  "src/services/promptBuilder.js"() {
    init_timing();
    SYSTEM_PROMPT = `You are Keyframe, an expert product demo scriptwriter and video director.
You have deep experience writing scripts for SaaS product demos, app walkthroughs,
and feature highlight videos. You think like a director: you know what to show,
what to skip, and exactly how long each shot should last.

NEVER BREAK THESE RULES:
1. ONLY reference screens/pages found in the scraped content. Never invent screens.
2. Shot timings must be mathematically precise. First shot starts at 0:00. Last shot
   ends at exactly the requested total duration. No gaps. No overlaps.
3. Shot count must match duration:
   30s \u2192 3\u20134 shots | 60s \u2192 5\u20137 shots | 90s \u2192 7\u20139 shots | 120s \u2192 9\u201312 shots
4. Narrator lines must be speakable in the shot's time window.
   Human speech = 130 words/minute. A 10-second shot = max ~22 words.
5. Cut list must contain ONLY screens from the scraped content that were considered
   but excluded. Minimum 2 items, maximum 8. Each reason must be specific.
6. NEVER use filler phrases like "In this video we will..." or "Welcome to our demo."
   Start the script with immediate value.
7. The video creation prompt must be self-contained. 300\u2013600 words.
8. Return ONLY valid JSON. Start with { and end with }. No markdown, no explanation.`;
    TONE_GUIDES = {
      professional: "Authoritative, clear, confident. Business-appropriate. No slang. Example: 'The dashboard gives your team a complete view of every project in flight.'",
      casual: "Friendly, warm, conversational. Everyday words. Light. Example: 'And this is where all the magic happens \u2014 your main dashboard.'",
      energetic: "Exciting, fast, punchy. Short sentences. Power words. Action-forward. Example: 'One click. New project. Done.'",
      technical: "Precise, detailed, feature-focused. Technical terms welcome. Example: 'The API integration layer supports OAuth 2.0 and webhook-based event streaming.'"
    };
    VIDEO_TOOL_GUIDES = {
      any: "Use plain language for scene descriptions. Works universally.",
      runway: "Camera movement first, then scene, then style. Use: slow zoom, pan left, static shot, dolly in.",
      pika: "Under 200 chars per scene. Format: [camera motion] [scene] [style].",
      heygen: "Teleprompter-ready. Include [PAUSE], [EMPHASIS], [GESTURE] markers.",
      synthesia: "Slide-by-slide with [SLIDE X] markers. Include 'Screen share:' per scene.",
      capcut: "Short, punchy. Include [CUT] and [TRANSITION] beat markers."
    };
    TONE_OPTIONS = [
      { value: "professional", label: "Professional" },
      { value: "casual", label: "Casual" },
      { value: "energetic", label: "Energetic" },
      { value: "technical", label: "Technical" }
    ];
    VIDEO_TOOL_OPTIONS = [
      { value: "any", label: "Any" },
      { value: "runway", label: "Runway" },
      { value: "pika", label: "Pika" },
      { value: "heygen", label: "HeyGen" },
      { value: "synthesia", label: "Synthesia" },
      { value: "capcut", label: "CapCut" }
    ];
    LENGTH_OPTIONS = [
      { value: 30, label: "30 seconds" },
      { value: 60, label: "60 seconds" },
      { value: 90, label: "90 seconds" },
      { value: 120, label: "120 seconds" }
    ];
    OUTPUT_SCHEMA = `=== OUTPUT FORMAT ===
Return ONLY a single valid JSON object \u2014 no markdown fences, no commentary.
Start with { and end with }. Exact structure:

{
  "meta": {
    "appName": "string",
    "appPurpose": "string \u2014 1 sentence",
    "totalSeconds": number,
    "shotCount": number,
    "estimatedWordCount": number,
    "tone": "string"
  },
  "script": [
    {
      "shotNumber": number,
      "label": "string \u2014 OPENING | FEATURE N | CLOSING \u2014 uppercase",
      "screen": "string \u2014 exact screen name from app content",
      "timeStart": "string \u2014 M:SS",
      "timeEnd": "string \u2014 M:SS",
      "durationSeconds": number,
      "action": "string \u2014 precise director instruction (specific, not vague)",
      "narration": "string \u2014 spoken words only, no stage directions"
    }
  ],
  "cutList": [
    {
      "screenName": "string",
      "reason": "string \u2014 1\u20133 sentences, specific to this screen"
    }
  ],
  "videoPrompt": {
    "target": "string",
    "fullPrompt": "string \u2014 320\u2013560 words of continuous prose, fully self-contained"
  }
}

FINAL CHECKS BEFORE YOU ANSWER:
- durationSeconds values sum to exactly the requested total.
- timeStart of shot 1 is "0:00"; timeEnd of the final shot equals the total as M:SS.
- Narration word counts obey 130 words/minute for each shot.
- cutList length is between 2 and 8 and every screenName exists in the scraped content.
- The videoPrompt.fullPrompt is ONGOING PROSE of at least 300 words. Spell out: the
  visual style (gradient, palette, depth, lighting), the UI motion and camera feel
  (e.g. "slow 4% push-in", "cursor glides, never jumps"), pacing and cut rhythm, and a
  beat-by-beat pass through every shot in order. Long and specific is correct here \u2014
  a one-paragraph summary is a FAILED answer.
- No invented screens, no filler opening lines, valid JSON only.`;
  }
});

// src/utils/wordCount.js
var wordCount_exports = {};
__export(wordCount_exports, {
  WORDS_PER_MINUTE: () => WORDS_PER_MINUTE,
  checkNarration: () => checkNarration,
  countWords: () => countWords,
  maxWordsForDuration: () => maxWordsForDuration,
  narrationSeconds: () => narrationSeconds,
  scriptWordStats: () => scriptWordStats
});
function speechOnly(text) {
  return String(text || "").replace(/\[[^\]]*\]/g, " ").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}
function countWords(text) {
  const clean = speechOnly(text);
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}
function maxWordsForDuration(durationSeconds) {
  const seconds = Math.max(0, Number(durationSeconds) || 0);
  return Math.floor(seconds / 60 * WORDS_PER_MINUTE);
}
function narrationSeconds(text) {
  return countWords(text) / WORDS_PER_MINUTE * 60;
}
function checkNarration(narration, durationSeconds) {
  const words = countWords(narration);
  const max = maxWordsForDuration(durationSeconds);
  return {
    words,
    max,
    over: Math.max(0, words - max),
    seconds: Math.round(narrationSeconds(narration)),
    fits: words <= max
  };
}
function scriptWordStats(script) {
  const shots = Array.isArray(script) ? script : [];
  const rows = shots.map((shot) => ({
    shotNumber: shot.shotNumber,
    ...checkNarration(shot.narration, shot.durationSeconds)
  }));
  return {
    rows,
    totalWords: rows.reduce((sum, r) => sum + r.words, 0),
    overflowing: rows.filter((r) => !r.fits)
  };
}
var WORDS_PER_MINUTE;
var init_wordCount = __esm({
  "src/utils/wordCount.js"() {
    WORDS_PER_MINUTE = 130;
  }
});

// src/services/outputParser.js
var outputParser_exports = {};
__export(outputParser_exports, {
  parseAndValidateOutput: () => parseAndValidateOutput
});
function shotRundownLines(script) {
  const lines = ["", "SHOT-BY-SHOT RUNDOWN (match these beats in order)"];
  (script || []).forEach((shot, index) => {
    const number = shot.shotNumber ?? index + 1;
    const label = shot.label || `SHOT ${number}`;
    const beats = [];
    if (shot.screen) beats.push(`on ${shot.screen}`);
    if (shot.action) beats.push(String(shot.action).trim().replace(/\.$/, ""));
    if (shot.narration) beats.push(`Voiceover: \u201C${String(shot.narration).trim()}\u201D`);
    lines.push(
      `${number}. ${shot.timeStart || "0:00"}\u2013${shot.timeEnd || ""} \u2014 ${label}: ${beats.join(". ")}.`
    );
  });
  return lines;
}
function padVideoPrompt(text, script, target) {
  const parts = [String(text).trim()];
  const sections = [
    shotRundownLines(script),
    DELIVERY_NOTES,
    PACING_CLOSER
  ];
  for (const section2 of sections) {
    for (const line of section2) {
      parts.push(line);
      if (countWords(parts.join(" ")) >= VIDEO_PROMPT_MIN) {
        return parts.join("\n");
      }
    }
  }
  return parts.join("\n");
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
  return kept.length ? kept.join(" ") : String(text).trim();
}
function stripFences(raw) {
  let text = String(raw ?? "").trim();
  text = text.replace(/^```(?:json|JSON)?\s*/i, "").replace(/```\s*$/, "");
  text = text.trim();
  if (text.startsWith("{") && text.endsWith("}")) return text;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
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
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function parseAndValidateOutput(rawContent) {
  let parsed = tryParse(String(rawContent ?? "").trim());
  if (!parsed) {
    parsed = tryParse(stripFences(rawContent));
  }
  if (!parsed || !isPlainObject(parsed)) {
    throw Object.assign(new Error(PARSE_ERROR.userMsg), PARSE_ERROR);
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in parsed)) {
      throw new Error(`AI output missing required section: "${key}"`);
    }
  }
  if (!isPlainObject(parsed.meta)) parsed.meta = {};
  const meta = parsed.meta;
  if (!Array.isArray(parsed.script) || parsed.script.length === 0) {
    throw new Error('AI output missing required section: "script" (empty script)');
  }
  const warnings = [];
  parsed.script = parsed.script.map((shot, index) => {
    const safe = isPlainObject(shot) ? { ...shot } : {};
    const missing = REQUIRED_SHOT_FIELDS.filter(
      (field) => safe[field] === void 0 || safe[field] === null || safe[field] === ""
    );
    if (missing.length) {
      warnings.push(`Shot ${index + 1} missing: ${missing.join(", ")} \u2014 placeholders injected.`);
      const placeholders = {
        shotNumber: index + 1,
        screen: "Unnamed screen",
        timeStart: "0:00",
        timeEnd: "0:00",
        durationSeconds: 5,
        action: "Hold on the interface \u2014 no specific direction returned.",
        narration: ""
      };
      missing.forEach((field) => {
        safe[field] = placeholders[field];
      });
    }
    safe.shotNumber = Number(safe.shotNumber) || index + 1;
    safe.durationSeconds = Math.max(1, Math.round(Number(safe.durationSeconds) || 5));
    safe.screen = String(safe.screen);
    safe.action = String(safe.action);
    safe.narration = String(safe.narration);
    safe.label = typeof safe.label === "string" && safe.label.trim() ? safe.label.trim().toUpperCase() : index === 0 ? "OPENING" : index === parsed.script.length - 1 ? "CLOSING" : `FEATURE ${index}`;
    safe.timeStart = String(safe.timeStart);
    safe.timeEnd = String(safe.timeEnd);
    return safe;
  });
  if (!meta.appName || typeof meta.appName !== "string") {
    meta.appName = inferAppName(parsed) || "Your app";
  }
  if (!meta.appPurpose || typeof meta.appPurpose !== "string") {
    meta.appPurpose = "Product demo walkthrough.";
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
  if (!meta.tone || typeof meta.tone !== "string") meta.tone = "professional";
  parsed.script = repairTimings(parsed.script, meta.totalSeconds);
  meta.shotCount = parsed.script.length;
  meta.estimatedWordCount = parsed.script.reduce(
    (sum, shot) => sum + countWords(shot.narration),
    0
  );
  const lastShot = parsed.script[parsed.script.length - 1];
  lastShot.timeEnd = secondsToTimestamp(meta.totalSeconds);
  lastShot.durationSeconds = Math.max(
    1,
    meta.totalSeconds - (parsed.script.length > 1 ? parsed.script.slice(0, -1).reduce((sum, shot) => sum + shot.durationSeconds, 0) : 0)
  );
  parsed.script = repairTimings(parsed.script, meta.totalSeconds);
  if (!Array.isArray(parsed.cutList)) {
    warnings.push("cutList was not an array \u2014 defaulted to [].");
    parsed.cutList = [];
  }
  parsed.cutList = parsed.cutList.filter((item) => isPlainObject(item)).map((item, index) => ({
    screenName: String(item.screenName || `Excluded screen ${index + 1}`),
    reason: String(item.reason || "Not enough screen time to cover it well.")
  }));
  if (!isPlainObject(parsed.videoPrompt)) {
    warnings.push("videoPrompt was malformed \u2014 rebuilt from defaults.");
    parsed.videoPrompt = {};
  }
  parsed.videoPrompt.target = typeof parsed.videoPrompt.target === "string" && parsed.videoPrompt.target ? parsed.videoPrompt.target : "any";
  if (typeof parsed.videoPrompt.fullPrompt !== "string" || parsed.videoPrompt.fullPrompt.trim().length < 40) {
    warnings.push("videoPrompt.fullPrompt missing or too short \u2014 placeholder inserted.");
    parsed.videoPrompt.fullPrompt = "ERROR: the AI did not return a usable video prompt for this generation. Regenerate the script, or copy the shot list above straight into your editor.";
  }
  const promptMissing = parsed.videoPrompt.fullPrompt.startsWith("ERROR:");
  if (!promptMissing) {
    const promptWords = countWords(parsed.videoPrompt.fullPrompt);
    if (promptWords < VIDEO_PROMPT_MIN) {
      parsed.videoPrompt.fullPrompt = padVideoPrompt(
        parsed.videoPrompt.fullPrompt,
        parsed.script,
        parsed.videoPrompt.target
      );
      warnings.push(
        `videoPrompt was ${promptWords} words \u2014 a shot rundown and delivery notes were appended to reach the ${VIDEO_PROMPT_MIN}-word minimum.`
      );
    } else if (promptWords > VIDEO_PROMPT_MAX) {
      parsed.videoPrompt.fullPrompt = trimToWordBudget(parsed.videoPrompt.fullPrompt, VIDEO_PROMPT_MAX);
      warnings.push(
        `videoPrompt was ${promptWords} words \u2014 trimmed to the ${VIDEO_PROMPT_MAX}-word limit at a sentence boundary.`
      );
    }
  }
  if (warnings.length) {
    console.warn("[Keyframe] Output warnings:\n" + warnings.join("\n"));
  }
  parsed.__warnings = warnings;
  return parsed;
}
function inferAppName(parsed) {
  const firstShot = parsed?.script?.[0];
  if (firstShot && typeof firstShot.title === "string") return firstShot.title;
  return "";
}
var VIDEO_PROMPT_MIN, VIDEO_PROMPT_MAX, DELIVERY_NOTES, PACING_CLOSER, REQUIRED_KEYS, REQUIRED_SHOT_FIELDS;
var init_outputParser = __esm({
  "src/services/outputParser.js"() {
    init_errorClassifier();
    init_timing();
    init_wordCount();
    VIDEO_PROMPT_MIN = 300;
    VIDEO_PROMPT_MAX = 600;
    DELIVERY_NOTES = [
      "",
      "DELIVERY NOTES",
      "- Aspect: 16:9 master at 1080p; render a 9:16 vertical crop for Shorts, Reels and TikTok.",
      "- Motion: continuous, confident moves \u2014 slow pushes and short glides, cut on action.",
      "- Pacing: every UI change resolves before the next one begins; no dead frames.",
      "- Legibility: keep the interface at 100% scale \u2014 never shrink the UI to fit two screens at once.",
      "- Text: burn captions from the voiceover lines above, inside the title-safe area.",
      "- Audio: clean voiceover over a restrained electronic bed, with quiet, audible UI clicks."
    ];
    PACING_CLOSER = [
      "",
      "Overall rhythm: open on the strongest visual moment, settle into a steady two-to-three",
      "second cut rhythm across the feature screens, then finish on the closing beat with the app",
      "name held on screen for a full second of silence before the cut to black. Keep every",
      "transition in one visual language so the sequence reads as a single continuous take",
      "rather than a stitched reel of separate clips."
    ];
    REQUIRED_KEYS = ["meta", "script", "cutList", "videoPrompt"];
    REQUIRED_SHOT_FIELDS = [
      "shotNumber",
      "screen",
      "timeStart",
      "timeEnd",
      "durationSeconds",
      "action",
      "narration"
    ];
  }
});

// src/store/storage.js
function readLS(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === void 0) return fallback;
    return raw;
  } catch (err) {
    console.warn(`[Keyframe] localStorage read failed for "${key}"`, err);
    return fallback;
  }
}
var KF_KEYS;
var init_storage = __esm({
  "src/store/storage.js"() {
    KF_KEYS = {
      settings: "kf_settings",
      groqKey: "kf_groq_key",
      lastInputs: "kf_last_inputs",
      historyIndex: "kf_history_index",
      theme: "kf_theme",
      installDismissed: "kf_install_dismissed",
      onboardingDone: "kf_onboarding_done"
    };
  }
});

// src/services/groq.js
var groq_exports = {};
__export(groq_exports, {
  GROQ_ENDPOINT: () => GROQ_ENDPOINT,
  GROQ_MODELS: () => GROQ_MODELS,
  generateScript: () => generateScript,
  generateWithFallback: () => generateWithFallback,
  hasUsableApiKey: () => hasUsableApiKey,
  maskKey: () => maskKey,
  resolveApiKey: () => resolveApiKey,
  validateApiKey: () => validateApiKey
});
function maskKey(key) {
  if (!key || key.length < 10) return "\u2022\u2022\u2022\u2022";
  return `${key.slice(0, 6)}\u2026${key.slice(-4)}`;
}
function resolveApiKey() {
  const userKey = String(readLS(KF_KEYS.groqKey, "") || "").trim();
  if (userKey.startsWith("gsk_")) return { key: userKey, source: "user" };
  const envKey = String("").trim();
  if (envKey.startsWith("gsk_")) return { key: envKey, source: "built-in" };
  throw new GroqError(401, { error: "no_api_key" });
}
function hasUsableApiKey() {
  try {
    resolveApiKey();
    return true;
  } catch (err) {
    return false;
  }
}
function trimForModel(jinaResult2, model) {
  const windowChars = Math.floor(model.contextWindow * 3);
  const budget = Math.min(PROMPT_CHAR_BUDGET, windowChars);
  const cleaned = String(jinaResult2.cleaned || "");
  if (cleaned.length <= budget) return jinaResult2;
  const trimmed = {
    ...jinaResult2,
    cleaned: cleaned.slice(0, budget),
    trimmed: true
  };
  trimmed.charCount = trimmed.cleaned.length;
  trimmed.estimatedTokens = Math.ceil(trimmed.charCount / 4);
  return trimmed;
}
async function generateScript(appUrl, userInputs, jinaResult2, apiKey, modelId, options = {}) {
  const { signal } = options;
  const model = GROQ_MODELS.find((m) => m.id === modelId) || GROQ_MODELS[0];
  const context = trimForModel(jinaResult2, model);
  const started = performance.now();
  const { messages } = buildFullPrompt(appUrl, userInputs, context);
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw Object.assign(new Error(OFFLINE.userMsg), OFFLINE);
  }
  let response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model.id,
        messages,
        temperature: 0.4,
        max_tokens: 3e3,
        // keeps prompt + completion inside the 8k TPM budget
        response_format: { type: "json_object" },
        ...model.reasoningEffort ? { reasoning_effort: model.reasoningEffort } : {},
        stream: false
      }),
      signal
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    console.warn("[Keyframe] Groq request failed:", err);
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
      outputTokens: data?.usage?.completion_tokens ?? 0
    }
  };
}
async function generateWithFallback(appUrl, userInputs, jinaResult2, apiKey, options = {}) {
  const { signal, onModelSwitch } = options;
  let lastError = null;
  for (let i = 0; i < GROQ_MODELS.length; i += 1) {
    const model = GROQ_MODELS[i];
    const isLast = i === GROQ_MODELS.length - 1;
    try {
      return await generateScript(appUrl, userInputs, jinaResult2, apiKey, model.id, { signal });
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      lastError = err;
      const rateLimited = err instanceof GroqError && err.status === 429;
      if (rateLimited && !isLast) {
        console.warn(`[Keyframe] ${model.id} rate limited \u2014 falling back to ${GROQ_MODELS[i + 1].id}`);
        if (typeof onModelSwitch === "function") onModelSwitch(model.id, GROQ_MODELS[i + 1].id);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new GroqError(500, null);
}
async function validateApiKey(key) {
  const value = String(key || "").trim();
  if (!value.startsWith("gsk_")) {
    return { valid: false, error: 'A Groq key starts with "gsk_".' };
  }
  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${value}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODELS[0].id,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        max_tokens: 3,
        temperature: 0,
        stream: false
      })
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
      error: "Could not reach Groq to validate the key. Check your connection.",
      type: "OFFLINE"
    };
  }
}
var GROQ_MODELS, GROQ_ENDPOINT, PROMPT_CHAR_BUDGET;
var init_groq = __esm({
  "src/services/groq.js"() {
    init_errorClassifier();
    init_promptBuilder();
    init_outputParser();
    init_storage();
    GROQ_MODELS = [
      { id: "openai/gpt-oss-120b", contextWindow: 131072, reasoningEffort: "low" },
      // primary
      { id: "openai/gpt-oss-20b", contextWindow: 131072, reasoningEffort: "low" }
      // fallback on 429
    ];
    GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
    PROMPT_CHAR_BUDGET = 14e3;
  }
});

// tools/pipeline-test.mjs
globalThis.window = globalThis;
var memory = /* @__PURE__ */ new Map();
globalThis.localStorage = {
  getItem: (k) => memory.has(k) ? memory.get(k) : null,
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  get length() {
    return memory.size;
  },
  key: (i) => [...memory.keys()][i] ?? null
};
try {
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true, userAgent: "node-pipeline-test", platform: "test", maxTouchPoints: 0 },
    configurable: true,
    writable: true
  });
} catch (err) {
}
if (typeof globalThis.performance === "undefined") {
  globalThis.performance = { now: () => Date.now() };
}
var { fetchAndCleanJina: fetchAndCleanJina2, cleanMarkdown: cleanMarkdown2, extractSections: extractSections2, isValidUrl: isValidUrl2 } = await Promise.resolve().then(() => (init_jina(), jina_exports));
var { buildFullPrompt: buildFullPrompt2, buildContextLayer: buildContextLayer2, buildParametersLayer: buildParametersLayer2, SYSTEM_PROMPT: SYSTEM_PROMPT2, OUTPUT_SCHEMA: OUTPUT_SCHEMA2 } = await Promise.resolve().then(() => (init_promptBuilder(), promptBuilder_exports));
var { parseAndValidateOutput: parseAndValidateOutput2 } = await Promise.resolve().then(() => (init_outputParser(), outputParser_exports));
var { GroqError: GroqError2, classifyGroqStatus: classifyGroqStatus2, normalizeError: normalizeError2 } = await Promise.resolve().then(() => (init_errorClassifier(), errorClassifier_exports));
var { secondsToTimestamp: secondsToTimestamp2, repairTimings: repairTimings2, sumDurations: sumDurations2, getShotRange: getShotRange2, timestampToSeconds: timestampToSeconds2 } = await Promise.resolve().then(() => (init_timing(), timing_exports));
var { countWords: countWords2, maxWordsForDuration: maxWordsForDuration2, scriptWordStats: scriptWordStats2 } = await Promise.resolve().then(() => (init_wordCount(), wordCount_exports));
var pass = 0;
var fail = 0;
var skip = 0;
var failures = [];
function check(name, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`  \u2705 ${name}${detail ? ` \u2014 ${detail}` : ""}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  \u274C ${name}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}
function skipped(name, why) {
  skip += 1;
  console.log(`  \u23ED\uFE0F  ${name} \u2014 ${why}`);
}
function section(title) {
  console.log(`
${title}`);
}
section("1. URL normalisation + validation");
check("bare domain is valid", isValidUrl2("stripe.com"));
check("full https URL is valid", isValidUrl2("https://dashboard.stripe.com/payments"));
check("http URL is valid", isValidUrl2("http://example.com"));
check("garbage rejected", !isValidUrl2("not a url"));
check("empty rejected", !isValidUrl2(""));
check("javascript: rejected", !isValidUrl2("javascript:alert(1)"));
section("2. Markdown cleaner (all six passes)");
var messy = [
  "# Pricing",
  "",
  "",
  "",
  "We use cookies to improve your experience. By clicking Accept you agree.",
  "Share on Twitter",
  "[Skip to content](#main-nav)",
  "## Real-time dashboards for every team",
  "## Real-time dashboards for every team",
  "## Real-time dashboards for every team",
  "Short",
  "Short",
  "### Export raw data with one click"
].join("\n");
var cleanedMessy = cleanMarkdown2(messy);
check("blank-line runs collapsed", !/\n{3,}/.test(cleanedMessy));
check("cookie notice removed", !/cookies/i.test(cleanedMessy));
check("social share text removed", !/share on twitter/i.test(cleanedMessy));
check("anchor-only line removed", !/\]\(#main-nav\)/.test(cleanedMessy));
check(
  "duplicate long lines deduped",
  (cleanedMessy.match(/Real-time dashboards/g) || []).length === 1
);
check("short duplicate lines preserved", (cleanedMessy.match(/^Short$/gm) || []).length === 2);
var longText = `# H
${"x".repeat(6e4)}`;
var capped = cleanMarkdown2(longText);
var capTarget = 48e3 + "\n\n[Content truncated]".length;
check("48k character cap enforced", capped.length <= capTarget, `${capped.length} chars (cap ${capTarget})`);
check("truncation marker appended", /\[Content truncated\]/.test(capped));
var sectionsFromMessy = extractSections2(cleanedMessy);
check("headings extracted", sectionsFromMessy.includes("Pricing") && sectionsFromMessy.includes("Export raw data with one click"), sectionsFromMessy.join(" | "));
section("3. Live Jina read of a real public page");
var candidates = [
  "https://tailwindcss.com/",
  "https://vitejs.dev/",
  "https://example.com/"
];
var jinaResult = null;
var jinaSource = null;
for (const candidate of candidates) {
  try {
    const result = await fetchAndCleanJina2(candidate);
    jinaResult = result;
    jinaSource = candidate;
    break;
  } catch (err) {
    console.log(`  \u2026 ${candidate} failed: ${err.message}`);
  }
}
check("Jina returned cleaned content", Boolean(jinaResult?.cleaned), jinaSource || "none");
if (jinaResult) {
  check("charCount > 200", jinaResult.charCount > 200, `${jinaResult.charCount} chars`);
  check("estimatedTokens \u2248 chars/4", jinaResult.estimatedTokens === Math.ceil(jinaResult.charCount / 4), `~${jinaResult.estimatedTokens} tokens`);
  check("sections array present", Array.isArray(jinaResult.sections), `${jinaResult.sections.length} headings`);
  check("content under cap", jinaResult.charCount <= 48020);
  check("sourceUrl normalised", /^https?:\/\//.test(jinaResult.sourceUrl));
}
section("4. Prompt builder (4 layers)");
if (jinaResult) {
  const inputs = { features: "One-click export, real-time collab", length: 90, tone: "professional", videoTool: "runway" };
  const built = buildFullPrompt2("https://example.com", inputs, jinaResult);
  check("two messages (system + user)", built.messages.length === 2);
  check("system role first", built.messages[0].role === "system");
  check("system prompt intact", built.messages[0].content === SYSTEM_PROMPT2);
  check("context layer present", built.messages[1].content.includes("=== APP CONTENT"));
  check("BEGIN/END fences present", built.messages[1].content.includes("--- BEGIN SCRAPED CONTENT ---") && built.messages[1].content.includes("--- END SCRAPED CONTENT ---"));
  check("parameters layer present", built.messages[1].content.includes("=== BRIEF ==="));
  check("shot range injected for 90s", built.messages[1].content.includes("7\u20139 shots"));
  check("tone guide injected", /Authoritative, clear, confident/.test(built.messages[1].content));
  check("video tool guide injected", /Camera movement first/.test(built.messages[1].content));
  check("output schema appended", built.messages[1].content.includes(OUTPUT_SCHEMA2.slice(0, 40)));
  const ctxOnly = buildContextLayer2(jinaResult, "https://example.com");
  check("context layer lists sections", ctxOnly.includes("Detected sections/screens:"));
  const params = buildParametersLayer2({ length: 30, tone: "energetic", videoTool: "pika" });
  check("30s \u2192 3\u20134 shots", params.includes("3\u20134 shots"));
  check("energetic guide", /Exciting, fast, punchy/.test(params));
  check("pika guide", /Under 200 chars per scene/.test(params));
  const paramsRequired = buildParametersLayer2({ requiredScreens: ["Billing", "Team settings"] });
  check("required screens honoured", paramsRequired.includes("MUST INCLUDE THESE SCREENS") && paramsRequired.includes("Billing"));
}
section("5. Timing utilities");
check("secondsToTimestamp(0) = 0:00", secondsToTimestamp2(0) === "0:00");
check("secondsToTimestamp(95) = 1:35", secondsToTimestamp2(95) === "1:35");
check("secondsToTimestamp(120) = 2:00", secondsToTimestamp2(120) === "2:00");
check("timestampToSeconds('1:35') = 95", timestampToSeconds2("1:35") === 95);
check("getShotRange(60)", getShotRange2(60) === "5\u20137 shots");
check("getShotRange fallback", getShotRange2(999) === "7\u20139 shots");
var wobbly = [
  { shotNumber: 1, durationSeconds: 12, narration: "a".repeat(1), screen: "A", action: "x" },
  { shotNumber: 2, durationSeconds: 31, narration: "", screen: "B", action: "y" },
  { shotNumber: 3, durationSeconds: 9, narration: "", screen: "C", action: "z" }
];
var repaired = repairTimings2(wobbly, 90);
check("repaired sum === 90", sumDurations2(repaired) === 90, `sum=${sumDurations2(repaired)}`);
check("first shot starts 0:00", repaired[0].timeStart === "0:00");
check("last shot ends 1:30", repaired[repaired.length - 1].timeEnd === "1:30");
check("timings contiguous", repaired[1].timeStart === repaired[0].timeEnd && repaired[2].timeStart === repaired[1].timeEnd);
var alreadyGood = repairTimings2([{ durationSeconds: 42 }, { durationSeconds: 48 }], 90);
check("exact input unchanged in duration", sumDurations2(alreadyGood) === 90);
var zeroDurations = repairTimings2([{ durationSeconds: 0 }, { durationSeconds: 0 }, { durationSeconds: 0 }], 90);
check("all-zero durations distributed", sumDurations2(zeroDurations) === 90);
section("6. Narration speaking-rate checks (130 wpm)");
check("10s shot \u2192 21 words", maxWordsForDuration2(10) === 21);
check("counts plain words", countWords2("The dashboard shows every project in flight") === 7);
check("strips stage directions", countWords2("(click Export) [PAUSE] Export now") === 2);
check("empty narration = 0", countWords2("") === 0);
var stats = scriptWordStats2([
  { shotNumber: 1, durationSeconds: 10, narration: Array(30).fill("word").join(" ") },
  { shotNumber: 2, durationSeconds: 20, narration: Array(40).fill("word").join(" ") }
]);
check("flags overflowing shot", stats.overflowing.length === 1 && stats.overflowing[0].shotNumber === 1);
check("total words summed", stats.totalWords === 70, `${stats.totalWords}`);
section("7. Output parser: valid payload");
var goodPayload = {
  meta: { appName: "Acme", appPurpose: "Project tracking.", totalSeconds: 60, shotCount: 6, estimatedWordCount: 120, tone: "professional" },
  script: [
    { shotNumber: 1, label: "OPENING", screen: "Home", timeStart: "0:00", timeEnd: "0:10", durationSeconds: 10, action: "Open the dashboard.", narration: "Acme gives your team one place to see everything." },
    { shotNumber: 2, label: "FEATURE 1", screen: "Boards", timeStart: "0:10", timeEnd: "0:25", durationSeconds: 15, action: "Drag a card between columns.", narration: "Drag any task and the whole board updates instantly for everyone." },
    { shotNumber: 3, label: "FEATURE 2", screen: "Reports", timeStart: "0:25", timeEnd: "0:40", durationSeconds: 15, action: "Filter by team.", narration: "Filter by team and see where work is really piling up." },
    { shotNumber: 4, label: "CLOSING", screen: "Pricing", timeStart: "0:40", timeEnd: "1:00", durationSeconds: 20, action: "Scroll the pricing tiers.", narration: "Start free, upgrade when the whole team moves in." }
  ],
  cutList: [
    { screenName: "Integrations", reason: "Great depth but only two integrations matter to a first-time viewer." },
    { screenName: "Mobile app", reason: "The desktop flow reads better on video; mobile is a second demo." }
  ],
  videoPrompt: { target: "runway", fullPrompt: "A 60 second product demo of Acme. ".repeat(20) }
};
var parsedGood = parseAndValidateOutput2(JSON.stringify(goodPayload));
check("parses valid JSON", parsedGood.meta.appName === "Acme");
check("timings resum to 60", sumDurations2(parsedGood.script) === 60);
check("last timeEnd is 1:00", parsedGood.script.at(-1).timeEnd === "1:00");
check("shotCount recomputed", parsedGood.meta.shotCount === 4);
check("word count recomputed", parsedGood.meta.estimatedWordCount > 0, `${parsedGood.meta.estimatedWordCount}`);
section("8. Output parser: malformed input repair");
var fenced = "```json\n" + JSON.stringify(goodPayload) + "\n```";
check("```json fences stripped", parseAndValidateOutput2(fenced).meta.appName === "Acme");
var chatter = `Here is your script:
${JSON.stringify(goodPayload)}
Hope it helps!`;
check("surrounding prose tolerated", parseAndValidateOutput2(chatter).meta.appName === "Acme");
var missingFields = JSON.stringify({
  ...goodPayload,
  script: [{ shotNumber: 1, screen: "Home" }, { shotNumber: 2, durationSeconds: 20 }]
});
var repairedFields = parseAndValidateOutput2(missingFields);
check("missing fields get placeholders (no crash)", repairedFields.script.length === 2);
check("placeholder narration is a string", typeof repairedFields.script[0].narration === "string");
check("placeholder action is a string", typeof repairedFields.script[1].action === "string");
check("placeholders flagged as warnings", repairedFields.__warnings.length >= 2, `${repairedFields.__warnings.length} warnings`);
var badCut = JSON.stringify({ ...goodPayload, cutList: "oops" });
check("non-array cutList \u2192 []", Array.isArray(parseAndValidateOutput2(badCut).cutList) && parseAndValidateOutput2(badCut).cutList.length === 0);
var badPrompt = JSON.stringify({ ...goodPayload, videoPrompt: { target: "pika" } });
check("missing fullPrompt \u2192 error string", /^ERROR:/.test(parseAndValidateOutput2(badPrompt).videoPrompt.fullPrompt));
var threw = null;
try {
  parseAndValidateOutput2("this is not json at all");
} catch (err) {
  threw = err;
}
check("unparseable \u2192 throws parse error", Boolean(threw) && /unparseable/i.test(threw.message));
threw = null;
try {
  const { script, ...rest } = goodPayload;
  parseAndValidateOutput2(JSON.stringify(rest));
} catch (err) {
  threw = err;
}
check("missing section names the key", Boolean(threw) && /"script"/.test(threw.message), threw?.message);
var offTimings = JSON.stringify({
  ...goodPayload,
  script: goodPayload.script.map((s) => ({ ...s, durationSeconds: 30 }))
});
var fixedTimings = parseAndValidateOutput2(offTimings);
check("wrong durations repaired to exact total", sumDurations2(fixedTimings.script) === 60, `sum=${sumDurations2(fixedTimings.script)}`);
section("9. Error classification");
var e401 = new GroqError2(401, { error: { message: "Invalid API Key" } });
var e429 = new GroqError2(429, { error: { message: "Rate limit reached" } });
var e503 = new GroqError2(503, { error: { message: "Service unavailable" } });
var e400 = new GroqError2(400, { error: { message: "bad payload" } });
var e500 = new GroqError2(500, {});
check("401 \u2192 INVALID_API_KEY / RETRY", e401.type === "INVALID_API_KEY" && e401.action === "RETRY");
check("429 \u2192 RATE_LIMITED / RETRY", e429.type === "RATE_LIMITED" && e429.action === "RETRY");
check("503 \u2192 GROQ_DOWN / RETRY", e503.type === "GROQ_DOWN" && e503.action === "RETRY");
check("400 \u2192 BAD_REQUEST / EDIT_INPUTS", e400.type === "BAD_REQUEST" && e400.action === "EDIT_INPUTS");
check("other \u2192 UNKNOWN / RETRY", e500.type === "UNKNOWN" && e500.action === "RETRY");
check("401 message is specific", /rejected/i.test(e401.userMsg));
check("429 message mentions the shared quota", /quota/i.test(e429.userMsg));
var norm = normalizeError2(e429);
check("normalizeError keeps type + action", norm.type === "RATE_LIMITED" && norm.action === "RETRY");
var normAbort = normalizeError2(Object.assign(new Error("aborted"), { name: "AbortError" }));
check("AbortError normalised", normAbort.type === "ABORTED");
section("10. Live Groq generation");
var groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || "";
if (!groqKey.startsWith("gsk_") || !jinaResult) {
  skipped("90s generation \u2192 7\u20139 shots", "no GROQ_API_KEY env var (pass one to run live checks)");
  skipped("60s generation \u2192 5\u20137 shots", "no GROQ_API_KEY env var");
  skipped("cut list 2\u20138 items", "no GROQ_API_KEY env var");
  skipped("tone produces different narration", "no GROQ_API_KEY env var");
  skipped("fallback model on 429", "requires live rate-limit conditions");
} else {
  const { generateWithFallback: generateWithFallback2 } = await Promise.resolve().then(() => (init_groq(), groq_exports));
  const runs = [
    { length: 90, tone: "professional", min: 7, max: 9 },
    { length: 60, tone: "energetic", min: 5, max: 7 }
  ];
  for (const run of runs) {
    try {
      const res = await generateWithFallback2(
        jinaSource,
        { features: "Dashboards, search, pricing", length: run.length, tone: run.tone, videoTool: "any" },
        jinaResult,
        groqKey
      );
      const shots = res.output.script;
      check(`${run.length}s \u2192 shots in range`, shots.length >= run.min && shots.length <= run.max, `${shots.length} shots`);
      check(`${run.length}s durations sum exactly`, sumDurations2(shots) === run.length, `sum=${sumDurations2(shots)}`);
      check(`${run.length}s first shot 0:00`, shots[0].timeStart === "0:00");
      check(`${run.length}s last shot ends on total`, shots.at(-1).timeEnd === secondsToTimestamp2(run.length));
      const over = scriptWordStats2(shots).overflowing;
      check(`${run.length}s narration fits speaking rate`, over.length === 0, over.map((o) => `shot ${o.shotNumber}: ${o.words}/${o.max}w`).join(", "));
      check(`${run.length}s cut list 2\u20138 items`, res.output.cutList.length >= 2 && res.output.cutList.length <= 8, `${res.output.cutList.length} items`);
      check(`${run.length}s video prompt 300\u2013600 words`, countWords2(res.output.videoPrompt.fullPrompt) >= 250, `${countWords2(res.output.videoPrompt.fullPrompt)} words`);
      const opener = shots[0].narration.toLowerCase();
      check(`${run.length}s no filler opening`, !/(in this video|welcome to)/.test(opener), `"${shots[0].narration.slice(0, 60)}\u2026"`);
    } catch (err) {
      check(`${run.length}s live generation`, false, err.message);
    }
  }
}
console.log("\n" + "\u2500".repeat(64));
console.log(`Phase 3 pipeline test: ${pass} passed, ${fail} failed, ${skip} skipped`);
if (failures.length) {
  console.log("Failures:\n  - " + failures.join("\n  - "));
}
console.log("\u2500".repeat(64));
process.exit(fail > 0 ? 1 : 0);

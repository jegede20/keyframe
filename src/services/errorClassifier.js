/* ═══════════════════════════════════════════════════════════════════════════
   ERROR CLASSIFIER — Section 6.2
   Every failure the user can hit is mapped to a specific, honest message.
   ═══════════════════════════════════════════════════════════════════════════ */

export class GroqError extends Error {
  constructor(status, body) {
    const info = classifyGroqStatus(status, body);
    super(info.userMsg);
    this.name = 'GroqError';
    this.status = status;
    this.type = info.type;
    this.title = info.title;
    this.userMsg = info.userMsg;
    this.suggestion = info.suggestion;
    this.action = info.action;
    this.body = body || null;
  }
}

export function classifyGroqStatus(status, body) {
  const detail =
    (body && (body.error?.message || body.message || body.detail)) || '';

  switch (status) {
    case 401:
      return {
        type: 'INVALID_API_KEY',
        title: 'AI key rejected',
        userMsg: "Keyframe's built-in Groq key was rejected by the API.",
        suggestion: 'Nothing to re-enter — this is service-side. Try again in a moment.',
        action: 'RETRY',
      };
    case 429:
      return {
        type: 'RATE_LIMITED',
        title: 'Rate limit reached',
        userMsg: "Keyframe's shared Groq quota is used up for this minute.",
        suggestion: detail || 'It refills every 60 seconds — give it a few moments, then generate again.',
        action: 'RETRY',
      };
    case 503:
      return {
        type: 'GROQ_DOWN',
        title: 'Groq is unavailable',
        userMsg:
          "Groq's servers are temporarily unavailable. This usually resolves in a few minutes.",
        suggestion: 'Try again in a minute — your inputs are safe.',
        action: 'RETRY',
      };
    case 400:
      return {
        type: 'BAD_REQUEST',
        title: 'Could not process that input',
        userMsg:
          "The AI couldn't process this input. Try simplifying your features list.",
        suggestion: detail || 'Shorter feature lists (a few key lines) work best.',
        action: 'EDIT_INPUTS',
      };
    case 413:
      /* Seen in the wild as a spurious edge rejection of a ~18 KB body — the
         page content is trimmed client-side, so size is not the real cause. */
      return {
        type: 'TOO_LARGE',
        title: 'The API rejected that request',
        userMsg: "Groq's edge refused the request before it reached the model.",
        suggestion: 'This is usually momentary — press Try Again. If it repeats, try a shorter landing page.',
        action: 'RETRY',
      };
    default:
      return {
        type: 'UNKNOWN',
        title: 'Something went wrong',
        userMsg: 'Something went wrong. Please try again.',
        suggestion: detail || null,
        action: 'RETRY',
      };
  }
}

/* ── Jina-specific errors — rendered by ErrorBox ───────────────────────── */
export const JINA_EMPTY = {
  type: 'JINA_EMPTY',
  title: "Couldn't read that URL",
  userMsg:
    "We couldn't read that URL. The site may be behind a login or heavily JS-gated.",
  suggestion: 'Try pasting a public landing or marketing page URL.',
  action: 'EDIT_INPUTS',
};

export const OFFLINE = {
  type: 'OFFLINE',
  title: "You're offline",
  userMsg: 'You appear to be offline. Keyframe needs an internet connection.',
  suggestion: 'Reconnect and Keyframe will pick up right where you left off.',
  action: 'RETRY_ONLINE',
};

export const URL_ERROR = {
  type: 'URL_ERROR',
  title: 'That URL looks wrong',
  userMsg: "That doesn't look like a valid web address.",
  suggestion: 'Include the full address, e.g. https://yourapp.com.',
  action: 'EDIT_INPUTS',
};

export const PARSE_ERROR = {
  type: 'PARSE_ERROR',
  title: 'Unreadable AI response',
  userMsg: 'AI returned unparseable output. Please try again.',
  suggestion: 'Regenerating usually fixes this — the model occasionally returns malformed JSON.',
  action: 'RETRY',
};

/* The completion stopped at the token ceiling: reasoning tokens count against
   max_tokens, so a long script can run out of room mid-JSON. */
export const TRUNCATED = {
  type: 'TRUNCATED',
  title: 'The script was cut short',
  userMsg: 'The AI ran out of room before it finished writing the script.',
  suggestion: 'Press Try Again — a second pass almost always comes back complete.',
  action: 'RETRY',
};

/* Valid JSON, but the model skipped a section outright — in practice it is
   always videoPrompt, the last and longest one, when it is running long. */
export function incompleteOutput(section) {
  return {
    type: 'INCOMPLETE_OUTPUT',
    title: 'The script came back incomplete',
    userMsg: `The AI left out the "${section}" part of the script.`,
    suggestion: 'Press Try Again — it usually writes the whole thing on a second pass.',
    action: 'RETRY',
  };
}

export const ABORT_ERROR = {
  type: 'ABORTED',
  title: 'Generation cancelled',
  userMsg: 'Generation was cancelled.',
  suggestion: null,
  action: 'RETRY',
};

/** Wraps any thrown value into the ErrorBox shape. */
export function normalizeError(error) {
  if (!error) {
    return {
      type: 'UNKNOWN',
      title: 'Something went wrong',
      userMsg: 'Something went wrong. Please try again.',
      suggestion: null,
      action: 'RETRY',
      raw: null,
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
      raw: error,
    };
  }

  if (error.type && error.userMsg) {
    return { ...error, raw: error };
  }

  if (error.name === 'AbortError') {
    return { ...ABORT_ERROR, raw: error };
  }

  if (error.name === 'TypeError' && /fetch/i.test(error.message || '')) {
    return {
      ...OFFLINE,
      suggestion: 'The request never reached the network. Check your connection.',
      raw: error,
    };
  }

  return {
    type: 'UNKNOWN',
    title: 'Something went wrong',
    userMsg: error.message || 'Something went wrong. Please try again.',
    suggestion: null,
    action: 'RETRY',
    raw: error,
  };
}

/** Human labels for the Jina HTTP failure path. */
export function jinaHttpError(status) {
  return {
    type: 'JINA_HTTP',
    title: 'Could not read that page',
    userMsg: `The reader returned an error (HTTP ${status}). The site may block automated reading.`,
    suggestion: 'Try a different public page from the same app.',
    action: 'EDIT_INPUTS',
    status,
  };
}

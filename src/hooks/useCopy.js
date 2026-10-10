import { useCallback, useEffect, useRef, useState } from 'react';

/** Legacy fallback for browsers without navigator.clipboard (or non-HTTPS). */
function legacyCopy(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    const selection = document.getSelection();
    const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
    return ok;
  } catch (err) {
    console.warn('[Keyframe] Legacy copy failed:', err);
    return false;
  }
}

/**
 * Section 5.5 — useCopy(resetDelay = 2000)
 * Tries navigator.clipboard.writeText, falls back to execCommand.
 */
export default function useCopy(resetDelay = 2000) {
  const [copiedId, setCopiedId] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const timer = useRef(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = useCallback(
    async (text, id = 'default') => {
      const value = typeof text === 'string' ? text : String(text ?? '');
      let ok = false;

      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(value);
          ok = true;
        } catch (err) {
          console.warn('[Keyframe] clipboard.writeText failed, trying fallback.', err);
          ok = legacyCopy(value);
        }
      } else {
        ok = legacyCopy(value);
      }

      setLastResult(ok ? 'copied' : 'failed');
      if (ok) {
        setCopiedId(id);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopiedId(null), resetDelay);
      }
      return ok;
    },
    [resetDelay]
  );

  const isCopied = useCallback((id = 'default') => copiedId === id, [copiedId]);

  return { copy, isCopied, copiedId, lastResult };
}

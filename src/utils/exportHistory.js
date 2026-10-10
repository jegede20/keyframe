/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT HISTORY — Section 5.5 (useHistory.exportHistory)
   Downloads a JSON blob. No server involved.
   ═══════════════════════════════════════════════════════════════════════════ */

export function downloadJSON(filename, payload) {
  try {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    // Give Safari a beat before revoking.
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  } catch (err) {
    console.warn('[Keyframe] JSON export failed:', err);
    return false;
  }
}

export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  } catch (err) {
    console.warn('[Keyframe] Text export failed:', err);
    return false;
  }
}

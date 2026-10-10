import Badge from '../shared/Badge.jsx';
import CopyButton from '../shared/CopyButton.jsx';
import { formatVideoPrompt } from '../../utils/formatScript.js';
import { countWords } from '../../utils/wordCount.js';

const TOOL_LABELS = {
  any: 'Any tool',
  runway: 'Runway',
  pika: 'Pika',
  heygen: 'HeyGen',
  synthesia: 'Synthesia',
  capcut: 'CapCut',
};

/** Section 8.5 — ready-to-paste video AI prompt, monospace + scrollable. */
export default function VideoPromptTab({ output, onToast }) {
  const prompt = output?.videoPrompt || {};
  const words = countWords(prompt.fullPrompt);

  return (
    <div className="kf-anim-tab">
      <header style={{ marginBottom: 14 }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 17,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          Ready-to-paste prompt for your video creation tool
        </h2>
        <p className="kf-small" style={{ color: 'var(--text-secondary)' }}>
          Target: {TOOL_LABELS[prompt.target] || prompt.target || 'Any'} · Length:{' '}
          {output?.meta?.totalSeconds || 0}s · ~{words} words
        </p>
      </header>

      <div style={{ marginBottom: 12 }}>
        <Badge variant="accent">{TOOL_LABELS[prompt.target] || prompt.target || 'Any tool'}</Badge>
      </div>

      <div
        className="kf-card"
        style={{
          padding: 24,
          maxHeight: 500,
          overflowY: 'auto',
          background: 'var(--bg-surface)',
        }}
      >
        <pre
          className="kf-mono"
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          {prompt.fullPrompt}
        </pre>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
        <CopyButton
          id="video-prompt"
          text={formatVideoPrompt(output)}
          label="Copy Prompt"
          copiedLabel="Copied! ✓"
          variant="primary"
          size="sm"
          onCopied={() => onToast?.('Video prompt copied to clipboard.', 'success')}
        />
      </div>
    </div>
  );
}

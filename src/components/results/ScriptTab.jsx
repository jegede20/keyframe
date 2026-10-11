import { Download } from 'lucide-react';
import ShotCard from './ShotCard.jsx';
import TimelineConnector from './TimelineConnector.jsx';
import { formatScript, outputFilename } from '../../utils/formatScript.js';
import { downloadText } from '../../utils/exportHistory.js';
import { scriptWordStats } from '../../utils/wordCount.js';

/** Section 8.5 — stats bar, shot list, download. */
export default function ScriptTab({ output, onToast }) {
  const shots = output?.script || [];
  const meta = output?.meta || {};
  const stats = scriptWordStats(shots);

  return (
    <div className="kf-anim-tab">
      {/* Stats bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <span className="kf-mono-pill" style={{ fontWeight: 500 }}>
          TOTAL: {meta.totalSeconds}s · {meta.shotCount || shots.length} shots · ~
          {meta.estimatedWordCount || stats.totalWords} words
        </span>
        {stats.overflowing.length > 0 && (
          <span
            className="kf-mono-pill"
            style={{ color: 'var(--accent-warning)', borderColor: 'var(--accent-warning)' }}
            title="Shots whose narration is a touch long at 130 words per minute"
          >
            ⚠ {stats.overflowing.length} shot{stats.overflowing.length === 1 ? '' : 's'} dense
          </span>
        )}
      </div>

      {/* Shot list */}
      <div>
        {shots.map((shot, index) => (
          <div key={`${shot.shotNumber}-${index}`}>
            {index > 0 && <TimelineConnector />}
            <ShotCard shot={shot} index={index} />
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'center',
          marginTop: 22,
        }}
      >
        {/* No copy button here: "Copy All" (the sticky bar on phones, the row
            below the shots on desktop) already copies exactly this text, and
            two identically-labelled controls in one view is what got reported.
            Downloading is unique to this row, so it stays. */}
        <button
          type="button"
          className="kf-btn kf-btn--secondary kf-btn--sm"
          aria-label="Download script as a text file"
          onClick={() => {
            downloadText(outputFilename(output), formatScript(output));
            onToast?.('Script downloaded as a .txt file.', 'success');
          }}
        >
          <Download size={15} /> <span className="copy-label">Download .txt</span>
        </button>
      </div>
    </div>
  );
}

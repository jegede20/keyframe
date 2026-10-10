import { Loader2 } from 'lucide-react';
import CutCard from './CutCard.jsx';
import CopyButton from '../shared/CopyButton.jsx';
import { formatCutList } from '../../utils/formatScript.js';

/**
 * Section 8.5 — every screen left out, and why.
 * "+ Add to Script" re-runs the full generation with that screen required.
 */
export default function CutListTab({ output, onAddToScript, regeneratingScreen = null, onToast }) {
  const items = output?.cutList || [];

  return (
    <div className="kf-anim-tab">
      <p className="kf-small" style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
        {items.length > 0
          ? `${items.length} screen${items.length === 1 ? '' : 's'} excluded from your script`
          : 'The AI returned no cut list for this run — regenerate to get the excluded screens.'}
      </p>

      {regeneratingScreen && (
        <div
          className="kf-anim-fade"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            marginBottom: 14,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
          }}
        >
          <Loader2 size={16} className="kf-anim-spin" color="var(--accent-primary)" />
          <span className="kf-small">Regenerating with {regeneratingScreen} included…</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item, index) => (
          <CutCard
            key={`${item.screenName}-${index}`}
            item={item}
            onAddToScript={onAddToScript}
            busy={Boolean(regeneratingScreen)}
          />
        ))}
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
          <CopyButton
            id="cut-list"
            text={formatCutList(output)}
            label="Copy Cut List"
            copiedLabel="Copied! ✓"
            variant="primary"
            size="sm"
            onCopied={() => onToast?.('Cut list copied to clipboard.', 'success')}
          />
        </div>
      )}
    </div>
  );
}

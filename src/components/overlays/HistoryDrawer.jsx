import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, Search, Trash2, X } from 'lucide-react';

const TONE_LABELS = {
  professional: 'Pro',
  casual: 'Casual',
  energetic: 'Energetic',
  technical: 'Tech',
};

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── One row, with swipe-to-delete on touch ────────────────────────────── */
function HistoryCard({ entry, onOpen, onDelete, onCopy }) {
  const [dragX, setDragX] = useState(0);
  const touch = useRef({ x: 0, y: 0, open: false, dragging: false });
  const THRESHOLD = 64;

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, open: touch.current.open, dragging: false };
  };
  const onTouchMove = (e) => {
    const t = e.touches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      touch.current.dragging = true;
      setDragX(Math.max(-96, Math.min(6, (touch.current.open ? -88 : 0) + dx)));
    }
  };
  const onTouchEnd = () => {
    if (!touch.current.dragging) return;
    const open = dragX < -THRESHOLD;
    touch.current.open = open;
    setDragX(open ? -88 : 0);
  };

  return (
    <li style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {/* Delete reveal layer */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--accent-danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 18,
        }}
      >
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          aria-label={`Delete script for ${entry.appName}`}
          style={{
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 44,
            padding: '0 10px',
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          <Trash2 size={16} /> Delete
        </button>
      </div>

      {/* Card */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(entry.id);
          }
        }}
        onClick={() => {
          if (touch.current.open) {
            touch.current.open = false;
            setDragX(0);
            return;
          }
          onOpen(entry.id);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="kf-history-card"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: touch.current.dragging ? 'none' : 'transform 220ms ease-out',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            className="kf-truncate"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 15,
              color: 'var(--text-primary)',
            }}
            title={entry.url}
          >
            {entry.appName || entry.url}
          </p>
          <p className="kf-caption kf-truncate" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
            {formatWhen(entry.createdAt)}
          </p>
          <p className="kf-mono" style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 6 }}>
            {entry.totalSeconds}s · {entry.shotCount} shots · {TONE_LABELS[entry.tone] || entry.tone}
          </p>
        </div>

        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="kf-icon-btn kf-icon-btn--sm"
            title="Copy full script"
            aria-label={`Copy full script for ${entry.appName}`}
            onClick={() => onCopy(entry.id)}
          >
            <Copy size={15} />
          </button>
          <button
            type="button"
            className="kf-icon-btn kf-icon-btn--sm kf-history-delete"
            title="Delete"
            aria-label={`Delete script for ${entry.appName}`}
            onClick={() => onDelete(entry.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
        </div>
      </li>
  );
}

/**
 * Section 8.6 — right drawer on desktop, full-screen takeover on mobile.
 */
export default function HistoryDrawer({
  open,
  onClose,
  historyIndex = [],
  onOpenScript,
  onDelete,
  onClearAll,
  onCopyScript,
  onToast,
}) {
  const [query, setQuery] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return historyIndex;
    return historyIndex.filter(
      (entry) =>
        String(entry.url || '').toLowerCase().includes(q) ||
        String(entry.features || '').toLowerCase().includes(q) ||
        String(entry.appName || '').toLowerCase().includes(q)
    );
  }, [historyIndex, query]);

  const handleCopy = async (id) => {
    if (onCopyScript) {
      await onCopyScript(id);
      return;
    }
    onToast?.('Open the script to copy it.', 'info');
  };

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 350,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Script history"
        className="kf-anim-slide-right kf-history-panel"
        style={{
          width: 360,
          maxWidth: '100%',
          height: '100%',
          background: 'var(--bg-primary)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            className="kf-icon-btn kf-back-btn"
            onClick={onClose}
            aria-label="Back"
          >
            <ArrowLeft size={19} />
          </button>
          <h2
            style={{
              flex: 1,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 17,
              color: 'var(--text-primary)',
            }}
          >
            📜 Script History
          </h2>
          <button type="button" className="kf-icon-btn kf-close-btn" onClick={onClose} aria-label="Close history">
            <X size={19} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ position: 'relative' }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 13,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
              }}
            >
              <Search size={16} />
            </span>
            <input
              type="search"
              className="kf-input kf-input--with-icon"
              style={{ height: 44 }}
              placeholder="Search history..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search history"
            />
          </div>
        </div>

        {/* List */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}
        >
          {historyIndex.length === 0 && (
            <p className="kf-small" style={{ color: 'var(--text-secondary)', paddingTop: 20, textAlign: 'center' }}>
              Nothing here yet. Generate a script and hit <strong>New Script</strong> — it saves automatically.
            </p>
          )}
          {historyIndex.length > 0 && filtered.length === 0 && (
            <p className="kf-small" style={{ color: 'var(--text-secondary)', paddingTop: 20, textAlign: 'center' }}>
              No saved scripts match “{query}”.
            </p>
          )}
          <ul
            aria-label="Saved scripts"
            style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none', margin: 0, padding: 0 }}
          >
          {filtered.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              onOpen={onOpenScript}
              onDelete={onDelete}
              onCopy={handleCopy}
            />
          ))}
          </ul>
        </div>

        {/* Footer */}
        <footer
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '12px 16px',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {historyIndex.length > 0 && (
            <button type="button" className="kf-btn kf-btn--danger kf-btn--sm" onClick={onClearAll}>
              <Trash2 size={15} /> Clear All History
            </button>
          )}
          <p className="kf-caption" style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>
            History is stored only on this device.
          </p>
        </footer>
      </div>

      <style>{`
        .kf-history-card:hover { border-color: var(--border-focus); }
        .kf-history-delete:hover { color: var(--accent-danger); }
        @media (max-width: 767px) {
          .kf-history-panel { width: 100% !important; border-left: none !important; }
        }
      `}</style>
    </div>
  );
}

/** Section 8.5 — 2px rail with accent dots linking shot cards. */
export default function TimelineConnector({ height = 26 }) {
  return (
    <div
      aria-hidden="true"
      className="kf-timeline-connector"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height,
        width: 24,
      }}
    >
      <span style={{ width: 2, height: 7, background: 'var(--accent-primary)', borderRadius: 2 }} />
      <span style={{ width: 2, flex: 1, background: 'var(--border-subtle)' }} />
      <span style={{ width: 2, height: 7, background: 'var(--accent-primary)', borderRadius: 2 }} />
      <style>{`
        @media (max-width: 767px) {
          .kf-timeline-connector { width: 12px !important; align-items: flex-start !important; }
          .kf-timeline-connector span { width: 1px !important; }
        }
      `}</style>
    </div>
  );
}

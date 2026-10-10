// NOTE: temporary shell — replaced by the full state machine in Phase 4H.
export default function App() {
  return (
    <div className="kf-shell">
      <main className="kf-container" style={{ paddingTop: 48 }}>
        <h1 className="kf-hero-headline">
          Keyframe — <span style={{ color: 'var(--accent-primary)' }}>boot ok</span>
        </h1>
        <p className="kf-body" style={{ color: 'var(--text-secondary)' }}>
          Phase 1 foundation. Design tokens loading.
        </p>
      </main>
    </div>
  );
}

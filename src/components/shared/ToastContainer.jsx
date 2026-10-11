import Toast from './Toast.jsx';

/** Section 8.7 — fixed bottom-right stack, above everything else. */
export default function ToastContainer({ toasts = [], onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
        zIndex: 400,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
      }}
      className="kf-toast-container"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
      <style>{`
        @media (min-width: 768px) {
          .kf-toast-container { bottom: 24px !important; }
        }
      `}</style>
    </div>
  );
}

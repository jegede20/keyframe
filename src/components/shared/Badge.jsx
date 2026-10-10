/** Small pill label. variant: 'soft' | 'accent' | 'glass' | 'mono' | 'warning' */
export default function Badge({ children, variant = 'soft', className = '', title }) {
  const styles = {
    soft: {
      background: 'var(--accent-primary-glow)',
      color: 'var(--accent-text)',
      border: '1px solid var(--border-subtle)',
    },
    accent: { background: 'var(--accent-primary)', color: '#fff' },
    glass: {
      background: 'var(--bg-surface)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border-subtle)',
    },
    mono: {
      background: 'var(--bg-surface)',
      color: 'var(--text-tertiary)',
      border: '1px solid var(--border-subtle)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
    },
    warning: {
      background: 'transparent',
      color: 'var(--accent-warning)',
      border: '1px solid var(--accent-warning)',
    },
  }[variant];

  return (
    <span className={`kf-pill ${className}`} style={styles} title={title}>
      {children}
    </span>
  );
}

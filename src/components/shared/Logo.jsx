/**
 * The Keyframe mark — a keyframe diamond sitting on a timeline track.
 *
 * It borrows the one shape every animation tool already uses to mean
 * "keyframe": a diamond pinned to a track. The diamond inherits the text
 * colour (white on dark, ink on light) while the track and its end markers
 * carry the brand accent, so the mark re-colours itself with the theme
 * instead of shipping two versions.
 *
 * Geometry is duplicated in tools/make_icons.py (app icons) and
 * tools/shot_templates.py (Open Graph + store shots) — keep the three in sync.
 */

export function LogoMark({ size = 20, title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {title ? <title>{title}</title> : null}
      <path d="M3.6 16h24.8" stroke="var(--accent-primary)" strokeWidth="2.2" strokeLinecap="round" opacity="0.38" />
      <circle cx="3.2" cy="16" r="1.9" fill="var(--accent-primary)" opacity="0.65" />
      <circle cx="28.8" cy="16" r="1.9" fill="var(--accent-primary)" opacity="0.65" />
      <path d="M16 8.8 23.2 16 16 23.2 8.8 16Z" fill="currentColor" />
    </svg>
  );
}

/** Mark + wordmark, for the navbar, footer and share images. */
export function LogoLockup({ size = 22, fontSize = 20 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <LogoMark size={size} />
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          lineHeight: 1,
        }}
      >
        Keyframe
      </span>
    </span>
  );
}

export default LogoMark;

import { Check, Clipboard, Copy as CopyIcon } from 'lucide-react';
import useCopy from '../../hooks/useCopy.js';

/**
 * Section 8.7 — clipboard → checkmark morph, "Copied!" then revert after 2s.
 * Desktop shows icon + label; `.copy-label` is hidden under 768px by CSS.
 */
export default function CopyButton({
  text,
  id = 'default',
  label = 'Copy',
  copiedLabel = 'Copied!',
  icon = 'copy',
  variant = 'secondary',
  size = 'sm',
  onCopied,
  className = '',
  title,
  disabled = false,
}) {
  const { copy, isCopied } = useCopy(2000);
  const copied = isCopied(id);
  const Icon = copied ? Check : icon === 'clipboard' ? Clipboard : CopyIcon;

  const handleClick = async () => {
    if (disabled) return;
    const ok = await copy(text ?? '', id);
    if (ok && typeof onCopied === 'function') onCopied();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={title || label}
      aria-label={copied ? copiedLabel : label}
      className={`kf-btn kf-btn--${variant} ${size === 'sm' ? 'kf-btn--sm' : ''} ${className}`}
      style={{
        color: copied ? 'var(--accent-secondary)' : undefined,
        borderColor: copied ? 'var(--accent-secondary)' : undefined,
        transition: 'color 180ms ease, border-color 180ms ease',
      }}
    >
      <Icon size={15} aria-hidden="true" />
      <span className="copy-label">{copied ? copiedLabel : label}</span>
    </button>
  );
}

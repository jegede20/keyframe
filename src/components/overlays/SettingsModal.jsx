import { useEffect, useState } from 'react';
import { ArrowLeft, Download, Eye, EyeOff, KeyRound, Trash2, X } from 'lucide-react';
import { KF_KEYS, readLS, writeLS, removeLS } from '../../store/storage.js';
import { validateApiKey } from '../../services/groq.js';
import { LENGTH_OPTIONS, TONE_OPTIONS, VIDEO_TOOL_OPTIONS } from '../../services/promptBuilder.js';

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 14,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--text-tertiary)',
          marginBottom: 12,
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="kf-label">{label}</span>
      {children}
      {hint && (
        <span className="kf-caption" style={{ color: 'var(--text-tertiary)' }}>
          {hint}
        </span>
      )}
    </label>
  );
}

/**
 * Section 8.6 — centered modal on desktop, full-screen on mobile.
 * Appearance · Defaults · API key (validated) · Data (export / clear all).
 */
export default function SettingsModal({ open, onClose, settings, updateSetting, onExport, onClearAllData, onToast }) {
  const [keyDraft, setKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setKeyDraft(readLS(KF_KEYS.groqKey, '') || '');
    setShowKey(false);
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const saveKey = async () => {
    const value = keyDraft.trim();
    if (!value) {
      removeLS(KF_KEYS.groqKey);
      onToast?.('API key removed — Keyframe will use the built-in key.', 'info');
      return;
    }
    setValidating(true);
    const result = await validateApiKey(value);
    setValidating(false);
    if (result.valid) {
      writeLS(KF_KEYS.groqKey, value);
      onToast?.('API key saved and validated.', 'success');
    } else {
      onToast?.(result.error || 'That key could not be validated.', 'error');
    }
  };

  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 360,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="kf-anim-modal kf-settings-panel"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-surface)',
            zIndex: 1,
            paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
          }}
        >
          <button type="button" className="kf-icon-btn kf-back-btn" onClick={onClose} aria-label="Back">
            <ArrowLeft size={19} />
          </button>
          <h2
            style={{
              flex: 1,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--text-primary)',
            }}
          >
            ⚙️ Settings
          </h2>
          <button type="button" className="kf-icon-btn kf-close-btn" onClick={onClose} aria-label="Close settings">
            <X size={19} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <Section title="Appearance">
            <Field label="Theme" hint="Applies instantly. 'System' follows your device setting.">
              <select
                className="kf-select"
                value={settings.theme}
                onChange={(e) => updateSetting('theme', e.target.value)}
              >
                <option value="system">System</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </Field>
          </Section>

          <Section title="Defaults">
            <Field label="Default Script Length">
              <select
                className="kf-select"
                value={settings.defaultLength}
                onChange={(e) => updateSetting('defaultLength', Number(e.target.value))}
              >
                {LENGTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Default Tone">
              <select
                className="kf-select"
                value={settings.defaultTone}
                onChange={(e) => updateSetting('defaultTone', e.target.value)}
              >
                {TONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Default Video Tool">
              <select
                className="kf-select"
                value={settings.defaultVideoTool}
                onChange={(e) => updateSetting('defaultVideoTool', e.target.value)}
              >
                {VIDEO_TOOL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="API Key">
            <Field
              label="Groq API Key"
              hint="Optional. Stored only on this device. Get a free key at console.groq.com"
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
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
                    <KeyRound size={16} />
                  </span>
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="kf-input kf-input--with-icon"
                    style={{ height: 44, paddingRight: 44 }}
                    placeholder="gsk_…"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <button
                    type="button"
                    className="kf-icon-btn kf-icon-btn--sm"
                    style={{ position: 'absolute', right: 4, top: 4 }}
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  type="button"
                  className="kf-btn kf-btn--primary"
                  onClick={saveKey}
                  disabled={validating}
                  style={{ flexShrink: 0 }}
                >
                  {validating ? 'Checking…' : 'Save'}
                </button>
              </div>
            </Field>
          </Section>

          <Section title="Data">
            <button type="button" className="kf-btn kf-btn--secondary" onClick={onExport} style={{ justifyContent: 'flex-start' }}>
              <Download size={16} /> Export History (JSON)
            </button>
            <button
              type="button"
              className="kf-btn kf-btn--danger"
              onClick={onClearAllData}
              style={{ justifyContent: 'flex-start' }}
            >
              <Trash2 size={16} /> Clear All Data
            </button>
            <p className="kf-caption" style={{ color: 'var(--text-tertiary)' }}>
              This will delete all scripts, settings, and your API key. Cannot be undone.
            </p>
          </Section>
        </div>

        <footer
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '14px 20px',
            paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
            textAlign: 'center',
          }}
        >
          <p className="kf-caption" style={{ color: 'var(--text-tertiary)' }}>
            Keyframe v1.0.0 — Made with ☕ and free tiers
          </p>
        </footer>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .kf-settings-panel {
            max-width: 100% !important;
            height: 100%;
            max-height: 100% !important;
            border-radius: 0 !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}

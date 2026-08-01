import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  /** Blinks counted since the alert opened. */
  blinksDone: number;
  blinksNeeded: number;
  /** Escape hatch, offered only after a delay — see ESCAPE_AFTER_MS. */
  onDismiss: () => void;
};

/**
 * Blinking clears this alert, not a button. The modal shows the live blink count and the
 * page closes it once the user has blinked `blinksNeeded` times.
 *
 * A dismiss link does appear, but only after ESCAPE_AFTER_MS. Without it a user whose face
 * has left the frame — walked away, camera covered, tracking lost — would be stuck behind a
 * full-screen overlay that also covers the Stop button, with no way out.
 */
const ESCAPE_AFTER_MS = 20_000;

export function DrynessModal({ open, blinksDone, blinksNeeded, onDismiss }: Props) {
  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (!open) {
      setCanDismiss(false);
      return;
    }
    const t = window.setTimeout(() => setCanDismiss(true), ESCAPE_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const remaining = Math.max(0, blinksNeeded - blinksDone);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dryness-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 360,
          padding: "28px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            margin: "0 auto 16px",
            background: "var(--tint)",
            display: "grid",
            placeItems: "center",
            fontSize: 28,
          }}
          aria-hidden
        >
          💧
        </div>
        <h2 id="dryness-title" className="h1" style={{ fontSize: "1.25rem" }}>
          Dryness detected
        </h2>
        <p className="sub" style={{ marginBottom: 18 }}>
          Your blink rate dropped below 7 blinks per minute. Blink slowly and completely{" "}
          <strong style={{ color: "var(--text)" }}>{blinksNeeded} times</strong> and this will clear itself.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 10 }} aria-hidden>
          {Array.from({ length: blinksNeeded }, (_, i) => (
            <span
              key={i}
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                border: "2px solid " + (i < blinksDone ? "var(--primary)" : "var(--border)"),
                background: i < blinksDone ? "var(--primary)" : "transparent",
                transition: "background 180ms ease, border-color 180ms ease",
              }}
            />
          ))}
        </div>

        <p aria-live="polite" style={{ fontWeight: 700, margin: "0 0 4px" }}>
          {blinksDone} of {blinksNeeded} blinks
        </p>
        <p className="sub" style={{ margin: 0, fontSize: "0.82rem" }}>
          {remaining === 0 ? "Nicely done — clearing…" : `${remaining} to go. Full, gentle closures work best.`}
        </p>

        {canDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              marginTop: 18,
              background: "none",
              border: "none",
              color: "var(--muted)",
              textDecoration: "underline",
              fontSize: "0.82rem",
              cursor: "pointer",
            }}
          >
            Can’t blink right now — dismiss
          </button>
        )}
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onAcknowledge: () => void;
};

export function DrynessModal({ open, onAcknowledge }: Props) {
  if (!open) return null;

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
            background: "rgba(46, 91, 255, 0.12)",
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
        <p className="sub" style={{ marginBottom: 20 }}>
          Your blink rate has dropped below 7 blinks per minute. Please blink at least 5 times slowly to rehydrate your
          eyes, then acknowledge below.
        </p>
        <button type="button" className="btn-primary" onClick={onAcknowledge}>
          I blinked — acknowledge
        </button>
      </div>
    </div>
  );
}

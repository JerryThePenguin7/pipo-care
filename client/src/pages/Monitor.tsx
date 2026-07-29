import { useCallback, useEffect, useRef, useState } from "react";
import { saveSession } from "../api";
import { DrynessModal } from "../components/DrynessModal";
import { useBlinkTracker } from "../hooks/useBlinkTracker";
import { cameraPrereqMessage, describeGetUserMediaError, isSecureContextForCamera } from "../lib/cameraContext";
import { statusFromBpm, statusLabel, type EyeStatus } from "../types";

const NOTIF_KEY = "pipo-care-notifications";

function badgeClass(s: EyeStatus) {
  if (s === "healthy") return "good";
  if (s === "medium") return "medium";
  if (s === "slightly_dry") return "warn";
  return "bad";
}

export function Monitor() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lowSinceRef = useRef<number | null>(null);
  const suppressUntilRef = useRef(0);
  const alertsRef = useRef(0);

  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rateUnit, setRateUnit] = useState<"min" | "hour">("min");
  const [showDryness, setShowDryness] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  const tracker = useBlinkTracker();

  useEffect(() => {
    tracker.initLandmarker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const startMonitoring = useCallback(async () => {
    setPermissionError(null);
    const blocked = cameraPrereqMessage();
    if (blocked) {
      setPermissionError(blocked);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      setSessionStartedAt(Date.now());
      alertsRef.current = 0;
      lowSinceRef.current = null;
      suppressUntilRef.current = 0;
      await tracker.start(v);
    } catch (e) {
      console.error(e);
      setPermissionError(describeGetUserMediaError(e));
    }
  }, [tracker]);

  const stopMonitoring = useCallback(async () => {
    const started = sessionStartedAt;
    const snap = tracker.stop();
    stopStream();
    setShowDryness(false);
    setSessionStartedAt(null);
    if (!started || !snap) return;

    const ended = Date.now();
    try {
      setSaving(true);
      await saveSession({
        startedAt: started,
        endedAt: ended,
        durationMs: ended - started,
        blinkCount: snap.blinkCount,
        avgBlinksPerMin: snap.avgBpmSession,
        minBpm: snap.minBpm,
        maxBpm: snap.maxBpm,
        status: snap.status,
        samples: snap.samples,
        alertsTriggered: alertsRef.current,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, [sessionStartedAt, stopStream, tracker]);

  useEffect(() => {
    if (!tracker.isRunning) {
      lowSinceRef.current = null;
      return;
    }
    const now = Date.now();
    if (now < suppressUntilRef.current) return;

    if (tracker.bpm < 7) {
      if (lowSinceRef.current === null) lowSinceRef.current = now;
      else if (now - lowSinceRef.current > 7000) {
        setShowDryness(true);
        try {
          if (localStorage.getItem(NOTIF_KEY) === "1" && Notification.permission === "granted") {
            new Notification("Pipo Care", { body: "Blink rate is low — time to blink and rest your eyes." });
          }
        } catch {
          /* ignore */
        }
      }
    } else {
      lowSinceRef.current = null;
    }
  }, [tracker.bpm, tracker.isRunning]);

  const acknowledgeDryness = useCallback(() => {
    alertsRef.current += 1;
    suppressUntilRef.current = Date.now() + 50_000;
    setShowDryness(false);
    lowSinceRef.current = null;
  }, []);

  const displayBpm = tracker.bpm;
  const displayAvg = tracker.avgBpmSession;
  const mult = rateUnit === "hour" ? 60 : 1;
  const status = statusFromBpm(displayAvg || displayBpm);

  const prereq = cameraPrereqMessage();
  const showLanCertHint =
    isSecureContextForCamera() &&
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  return (
    <div className="page">
      <DrynessModal open={showDryness} onAcknowledge={acknowledgeDryness} />

      <header style={{ marginBottom: 12 }}>
        <h1 className="h1">Monitoring</h1>
        <p className="sub" style={{ margin: 0 }}>
          Professional on-device vision pipeline (MediaPipe Face Landmarker + eye aspect analysis).
        </p>
      </header>

      {prereq && (
        <div
          className="card"
          style={{
            padding: 14,
            marginBottom: 12,
            borderColor: "var(--bad)",
            background: "rgba(239, 68, 68, 0.08)",
          }}
          role="status"
        >
          <strong style={{ color: "var(--bad)" }}>Camera unavailable on this address</strong>
          <p className="sub" style={{ margin: "8px 0 0", color: "var(--text)" }}>
            {prereq}
          </p>
        </div>
      )}

      {showLanCertHint && (
        <div
          className="card"
          style={{
            padding: 12,
            marginBottom: 12,
            background: "rgba(46, 91, 255, 0.08)",
            borderColor: "rgba(46, 91, 255, 0.35)",
          }}
        >
          <p className="sub" style={{ margin: 0, color: "var(--text)", fontSize: "0.85rem" }}>
            <strong>Phone (Chrome):</strong> the first time you open this dev link you may see a certificate warning —
            choose <strong>Advanced</strong> → <strong>Proceed</strong> (local Wi‑Fi only). Then tap <strong>Start capture</strong> and
            allow <strong>Camera</strong> when Chrome asks.
          </p>
        </div>
      )}

      <div className="split">
      <div>
      <section
        className="card"
        style={{
          padding: 12,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: "100%",
            borderRadius: 12,
            background: "#0f172a",
            aspectRatio: "4 / 3",
            objectFit: "cover",
            transform: "scaleX(-1)",
          }}
        />
        {tracker.isRunning && (
          <div style={{ position: "absolute", top: 20, left: 20, display: "flex", gap: 8 }}>
            <span className="badge bad" style={{ background: "rgba(239,68,68,0.9)", color: "white" }}>
              LIVE
            </span>
            <span className="badge good" style={{ background: "rgba(34,197,94,0.9)", color: "white" }}>
              Tracking {tracker.faceDetected ? "active" : "searching…"}
            </span>
          </div>
        )}
      </section>

      {permissionError && (
        <p style={{ color: "var(--bad)", fontWeight: 600, marginTop: 12 }} role="alert">
          {permissionError}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "center", margin: "18px 0" }}>
        {!tracker.isRunning ? (
          <button
            type="button"
            className="btn-primary"
            onClick={startMonitoring}
            disabled={!!tracker.error || !!prereq}
          >
            {tracker.error ? "Tracking unavailable" : !tracker.isReady ? "Preparing models…" : "Start capture"}
          </button>
        ) : (
          <button type="button" className="btn-danger" onClick={stopMonitoring} disabled={saving}>
            {saving ? "Saving…" : "Stop"}
          </button>
        )}
      </div>

      {tracker.error && (
        <p className="sub" role="alert">
          {tracker.error}
        </p>
      )}
      </div>

      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 className="h1" style={{ fontSize: "1rem", margin: 0 }}>
            Live statistics
          </h2>
          <span className={"badge " + badgeClass(status)}>{statusLabel(status)}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="card" style={{ padding: 12, boxShadow: "none" }}>
            <div className="sub" style={{ margin: "0 0 6px", fontSize: "0.75rem" }}>
              Rolling blink rate (≈last 60s)
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--primary)" }}>
              {(displayBpm * mult).toFixed(rateUnit === "hour" ? 1 : 0)}
              <span style={{ fontSize: "0.95rem", fontWeight: 600 }}> /{rateUnit}</span>
            </div>
          </div>
          <div className="card" style={{ padding: 12, boxShadow: "none" }}>
            <div className="sub" style={{ margin: "0 0 6px", fontSize: "0.75rem" }}>
              Session average
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>
              {(displayAvg * mult).toFixed(1)}
              <span style={{ fontSize: "0.95rem", fontWeight: 600 }}> /{rateUnit}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="sub" style={{ margin: 0, fontSize: "0.85rem" }}>
            Rate unit:
          </span>
          <button
            type="button"
            className={"chip" + (rateUnit === "min" ? " active" : "")}
            onClick={() => setRateUnit("min")}
          >
            Per minute
          </button>
          <button
            type="button"
            className={"chip" + (rateUnit === "hour" ? " active" : "")}
            onClick={() => setRateUnit("hour")}
          >
            Per hour
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="sub" style={{ margin: "0 0 6px", fontSize: "0.8rem" }}>
            Hydration hint (from blink rhythm)
          </div>
          <div
            style={{
              height: 12,
              borderRadius: 999,
              background: "linear-gradient(90deg, #2e5bff, #4a69ff, #f59e0b, #ef4444)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${Math.min(100, Math.max(8, (displayBpm / 20) * 100))}%`,
                background: "rgba(255,255,255,0.35)",
                borderRadius: 999,
              }}
            />
          </div>
          <p className="sub" style={{ margin: "10px 0 0", fontSize: "0.85rem" }}>
            {displayBpm < 7
              ? "Warning: blink rate is low. Follow the full-screen prompt and take a short break from the screen."
              : displayBpm < 12
                ? "Moderate. Try the 20-20-20 rule: every 20 minutes, look 20 feet away for 20 seconds."
                : "Nice rhythm — keep gentle, complete blinks while you work."}
          </p>
        </div>

        <div className="sub" style={{ margin: "14px 0 0", fontSize: "0.8rem" }}>
          Total blinks this session: <strong style={{ color: "var(--text)" }}>{tracker.blinkCount}</strong> · Eye-opening
          proxy (EAR): <strong style={{ color: "var(--text)" }}>{tracker.avgEar.toFixed(3)}</strong>
          <span className="sub" style={{ display: "block", marginTop: 6, fontSize: "0.75rem" }}>
            Lower values during a blink are normal — the app compares each frame to your usual “eyes open” level.
          </span>
        </div>
      </section>
      </div>
    </div>
  );
}

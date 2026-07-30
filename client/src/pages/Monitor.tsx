import { useCallback, useEffect, useRef, useState } from "react";
import { saveSession } from "../api";
import { DrynessModal } from "../components/DrynessModal";
import { useBlinkTracker } from "../hooks/useBlinkTracker";
import { cameraPrereqMessage, describeGetUserMediaError, isSecureContextForCamera } from "../lib/cameraContext";
import { playAlertChime, unlockAlertSound } from "../lib/alertSound";
import { statusFromBpm, statusLabel, type EyeStatus } from "../types";

const NOTIF_KEY = "pipo-care-notifications";

/** Blinks required to clear a dryness alert. */
const BLINKS_TO_CLEAR = 5;
/** How often the alert re-notifies while it is still unresolved and the tab is hidden. */
const REMINDER_MS = 8_000;
/** Quiet period after an alert clears, so it cannot immediately re-fire. */
const SUPPRESS_MS = 50_000;
/** Rolling rate must stay under the threshold this long before an alert opens. */
const LOW_FOR_MS = 7_000;

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
  const [blinksDone, setBlinksDone] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  /** Session blink count when the current alert opened; progress is measured from it. */
  const alertBaselineRef = useRef(0);
  const alertOpenRef = useRef(false);
  const reminderRef = useRef<number | null>(null);
  const notificationRef = useRef<Notification | null>(null);
  /** Latest blink count, readable from timers and callbacks without stale closures. */
  const blinkCountRef = useRef(0);

  const tracker = useBlinkTracker();

  useEffect(() => {
    blinkCountRef.current = tracker.blinkCount;
  }, [tracker.blinkCount]);

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

  /**
   * Fires (or re-fires) the OS notification. A stable tag replaces the previous one instead
   * of stacking them up; renotify makes the replacement alert again rather than land silently.
   */
  const pushDrynessNotification = useCallback((done: number) => {
    try {
      if (localStorage.getItem(NOTIF_KEY) !== "1") return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;

      notificationRef.current?.close();
      const options = {
        body: `Blink slowly ${BLINKS_TO_CLEAR} times to clear this — ${done} of ${BLINKS_TO_CLEAR} done.`,
        tag: "pipo-care-dryness",
        renotify: true,
        requireInteraction: true,
      } as NotificationOptions;
      const n = new Notification("Pipo Care — your eyes need a blink", options);
      n.onclick = () => {
        window.focus();
        n.close();
      };
      notificationRef.current = n;
    } catch {
      /* notifications unavailable — the in-app modal and chime still cover it */
    }
  }, []);

  const stopReminders = useCallback(() => {
    if (reminderRef.current !== null) {
      window.clearInterval(reminderRef.current);
      reminderRef.current = null;
    }
    notificationRef.current?.close();
    notificationRef.current = null;
  }, []);

  const startMonitoring = useCallback(async () => {
    setPermissionError(null);
    // This click is the only chance to unlock audio — alert chimes fire much later,
    // long after any user gesture, and browsers block a cold AudioContext.
    unlockAlertSound();
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
      alertOpenRef.current = false;
      blinkCountRef.current = 0;
      setBlinksDone(0);
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
    alertOpenRef.current = false;
    setShowDryness(false);
    setBlinksDone(0);
    stopReminders();
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
  }, [sessionStartedAt, stopReminders, stopStream, tracker]);

  /** Clears the alert: blinks completed, or the user used the delayed dismiss link. */
  const resolveDryness = useCallback(() => {
    alertOpenRef.current = false;
    setShowDryness(false);
    setBlinksDone(0);
    suppressUntilRef.current = Date.now() + SUPPRESS_MS;
    lowSinceRef.current = null;
    stopReminders();
  }, [stopReminders]);

  /**
   * Opens the alert and starts nagging. The reminder keeps re-notifying with a chime for as
   * long as the alert is unresolved and the tab is hidden — that is the whole point: someone
   * who tabbed away should not be able to ignore it, and only blinking stops it.
   */
  const openDryness = useCallback(() => {
    if (alertOpenRef.current) return;
    alertOpenRef.current = true;
    alertBaselineRef.current = blinkCountRef.current;
    alertsRef.current += 1;
    setBlinksDone(0);
    setShowDryness(true);
    playAlertChime();
    pushDrynessNotification(0);

    reminderRef.current = window.setInterval(() => {
      if (!alertOpenRef.current) return;
      const done = Math.min(
        BLINKS_TO_CLEAR,
        Math.max(0, blinkCountRef.current - alertBaselineRef.current)
      );
      // On screen the modal already shows the countdown, so only nag when hidden.
      if (document.hidden) {
        pushDrynessNotification(done);
        playAlertChime();
      }
    }, REMINDER_MS);
  }, [pushDrynessNotification]);

  // Detect a sustained low blink rate and open the alert.
  useEffect(() => {
    if (!tracker.isRunning) {
      lowSinceRef.current = null;
      return;
    }
    if (alertOpenRef.current) return;

    const now = Date.now();
    if (now < suppressUntilRef.current) return;

    if (tracker.bpm < 7) {
      if (lowSinceRef.current === null) lowSinceRef.current = now;
      else if (now - lowSinceRef.current > LOW_FOR_MS) openDryness();
    } else {
      lowSinceRef.current = null;
    }
  }, [tracker.bpm, tracker.isRunning, openDryness]);

  // Count blinks against the alert and clear it once the target is reached.
  useEffect(() => {
    if (!showDryness) return;
    const done = Math.max(0, tracker.blinkCount - alertBaselineRef.current);
    setBlinksDone(Math.min(done, BLINKS_TO_CLEAR));
    if (done >= BLINKS_TO_CLEAR) resolveDryness();
  }, [showDryness, tracker.blinkCount, resolveDryness]);

  // Coming back to the tab should silence the OS notification; the modal takes over.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) {
        notificationRef.current?.close();
        notificationRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Never leave an interval or a notification behind.
  useEffect(() => () => stopReminders(), [stopReminders]);

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
      <DrynessModal
        open={showDryness}
        blinksDone={blinksDone}
        blinksNeeded={BLINKS_TO_CLEAR}
        onDismiss={resolveDryness}
      />

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

import { useCallback, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { EyeStatus, SamplePoint } from "../types";
import { statusFromBpm } from "../types";

/** MediaPipe Face Landmarker topology — six points per eye for EAR. */
const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(landmarks: { x: number; y: number }[], indices: number[]) {
  const p = indices.map((i) => landmarks[i]);
  const d = dist;
  const denom = d(p[0], p[3]);
  if (denom < 1e-6) return 1;
  return (d(p[1], p[5]) + d(p[2], p[4])) / (2 * denom);
}

function blendBlinkScore(categories: { categoryName?: string; category?: string; score: number }[] | undefined) {
  if (!categories?.length) return 0;
  let L = 0;
  let R = 0;
  let anyBlink = 0;
  for (const c of categories) {
    const name = (c.categoryName || c.category || "").toLowerCase();
    if (name.includes("blink")) anyBlink = Math.max(anyBlink, c.score);
    if (name.includes("eyeblink") && name.includes("left")) L = Math.max(L, c.score);
    if (name.includes("eyeblink") && name.includes("right")) R = Math.max(R, c.score);
  }
  if (L === 0 && R === 0) return anyBlink;
  return Math.max(anyBlink, (L + R) / 2);
}

export type TrackerSnapshot = {
  blinkCount: number;
  bpm: number;
  avgBpmSession: number;
  minBpm: number;
  maxBpm: number;
  status: EyeStatus;
  samples: SamplePoint[];
};

export function useBlinkTracker() {
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blinkCount, setBlinkCount] = useState(0);
  const [bpm, setBpm] = useState(0);
  const [avgBpmSession, setAvgBpmSession] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [avgEar, setAvgEar] = useState(1);

  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionStartRef = useRef<number>(0);
  const blinkTimesRef = useRef<number[]>([]);
  const totalBlinksRef = useRef(0);
  const lastBlinkTsRef = useRef<number>(0);
  const eyeClosedRef = useRef(false);
  const samplesRef = useRef<SamplePoint[]>([]);
  const lastSampleTsRef = useRef(0);
  const minBpmRef = useRef(Infinity);
  const maxBpmRef = useRef(0);
  const bpmHistoryRef = useRef<number[]>([]);
  /** MediaPipe requires monotonically increasing timestamps aligned with the video clock (mobile-safe). */
  const lastMpTsRef = useRef(0);
  /** Avoid scheduling tick after stop() (prevents runaway rAF if video ref is cleared). */
  const sessionActiveRef = useRef(false);
  /**
   * Smoothed "eyes open" EAR (distance/lighting changes the absolute scale).
   * Fixed thresholds (e.g. 0.28) fail when open-eye EAR is ~0.15–0.18 — we then never count blinks.
   */
  const baselineEarRef = useRef<number | null>(null);

  const initLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return;
    setError(null);
    try {
      const wasm = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm";
      const fileset = await FilesetResolver.forVisionTasks(wasm);
      const modelUrl =
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

      const tryCreate = async (delegate: "GPU" | "CPU") =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: modelUrl,
            delegate,
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        });

      const mobile = /android|iphone|ipad|ipod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "");
      if (mobile) {
        try {
          landmarkerRef.current = await tryCreate("CPU");
        } catch {
          landmarkerRef.current = await tryCreate("GPU");
        }
      } else {
        try {
          landmarkerRef.current = await tryCreate("GPU");
        } catch {
          landmarkerRef.current = await tryCreate("CPU");
        }
      }
      setIsReady(true);
    } catch (e) {
      console.error(e);
      setError("Could not load eye tracking. Check your connection and try again.");
      setIsReady(false);
    }
  }, []);

  const pushSample = useCallback((now: number, cum: number, rollingBpm: number, ear: number) => {
    const elapsed = (now - sessionStartRef.current) / 1000;
    const st = statusFromBpm(rollingBpm);
    samplesRef.current.push({
      t: Math.round(elapsed * 10) / 10,
      bpm: Math.round(rollingBpm * 10) / 10,
      cumBlinks: cum,
      avgEar: Math.round(ear * 1000) / 1000,
      status: st,
    });
  }, []);

  const tick = useCallback(() => {
    if (!sessionActiveRef.current) return;

    const video = videoRef.current;
    const lm = landmarkerRef.current;
    if (!lm) return;

    if (!video || video.readyState < 2 || !video.videoWidth) {
      if (sessionActiveRef.current) rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const now = performance.now();
    const rawMs =
      video.currentTime > 0 ? video.currentTime * 1000 : now - sessionStartRef.current;
    let ts = Math.max(Math.round(rawMs), lastMpTsRef.current + 1);
    lastMpTsRef.current = ts;

    let result;
    try {
      result = lm.detectForVideo(video, ts);
    } catch {
      if (sessionActiveRef.current) rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const hasFace = Boolean(result.faceLandmarks?.[0]?.length);
    setFaceDetected(hasFace);

    if (hasFace && result.faceLandmarks?.[0]) {
      const marks = result.faceLandmarks[0];
      const earL = eyeAspectRatio(marks, LEFT_EYE);
      const earR = eyeAspectRatio(marks, RIGHT_EYE);
      const ear = (earL + earR) / 2;
      setAvgEar(ear);
      const earMin = Math.min(earL, earR);
      const earMax = Math.max(earL, earR);

      const blend = blendBlinkScore(result.faceBlendshapes?.[0]?.categories as never);

      /**
       * Baseline-relative blink detection. EAR scale varies a lot by camera/distance; open eyes can sit
       * ~0.15–0.18 with blinks near ~0.01. We compare each frame to a smoothed "open" baseline instead
       * of hard-coded 0.28+ thresholds (which treated normal open eyes as permanently "closed").
       */
      const br = baselineEarRef.current;
      const baseline = br != null ? Math.max(br, 0.04) : Math.max(ear, 0.08);
      const earVsBaseline = baseline > 1e-6 ? earMin / baseline : 1;

      const CLOSED_BLEND = 0.54;
      const looksClosed = earVsBaseline < 0.5 || blend > CLOSED_BLEND;
      const looksOpen =
        earMax > baseline * 0.88 ||
        (blend < 0.4 && earMin > baseline * 0.62) ||
        (blend < 0.32 && ear > baseline * 0.75);

      if (!eyeClosedRef.current) {
        if (looksClosed) eyeClosedRef.current = true;
      } else {
        if (looksOpen) {
          eyeClosedRef.current = false;
          if (now - sessionStartRef.current > 350 && now - lastBlinkTsRef.current > 100) {
            lastBlinkTsRef.current = now;
            totalBlinksRef.current += 1;
            blinkTimesRef.current.push(now);
            setBlinkCount(totalBlinksRef.current);
          }
        }
      }

      if (!eyeClosedRef.current && blend < 0.45 && ear > 0.03) {
        const prev = baselineEarRef.current;
        baselineEarRef.current = prev === null ? ear : prev * 0.88 + ear * 0.12;
      }

      const windowMs = 60_000;
      blinkTimesRef.current = blinkTimesRef.current.filter((t) => now - t <= windowMs);
      const rollingBpm = blinkTimesRef.current.length;
      setBpm(rollingBpm);

      const elapsedMin = Math.max((now - sessionStartRef.current) / 60000, 1 / 60);
      const sessionAvg = totalBlinksRef.current / elapsedMin;
      setAvgBpmSession(Math.round(sessionAvg * 10) / 10);

      if (rollingBpm < minBpmRef.current) minBpmRef.current = rollingBpm;
      if (rollingBpm > maxBpmRef.current) maxBpmRef.current = rollingBpm;
      bpmHistoryRef.current.push(rollingBpm);

      if (now - lastSampleTsRef.current >= 5000) {
        lastSampleTsRef.current = now;
        pushSample(now, totalBlinksRef.current, rollingBpm, ear);
      }
    }

    if (sessionActiveRef.current) rafRef.current = requestAnimationFrame(tick);
  }, [pushSample]);

  const start = useCallback(
    async (video: HTMLVideoElement) => {
      await initLandmarker();
      if (!landmarkerRef.current) return;

      videoRef.current = video;
      sessionStartRef.current = performance.now();
      blinkTimesRef.current = [];
      totalBlinksRef.current = 0;
      samplesRef.current = [];
      lastSampleTsRef.current = 0;
      lastBlinkTsRef.current = 0;
      lastMpTsRef.current = 0;
      baselineEarRef.current = null;
      eyeClosedRef.current = false;
      minBpmRef.current = Infinity;
      maxBpmRef.current = 0;
      bpmHistoryRef.current = [];
      setBlinkCount(0);
      setBpm(0);
      setAvgBpmSession(0);
      setIsRunning(true);
      sessionActiveRef.current = true;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    },
    [initLandmarker, tick]
  );

  const stop = useCallback((): TrackerSnapshot | null => {
    sessionActiveRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsRunning(false);
    const lm = landmarkerRef.current;
    const video = videoRef.current;
    if (lm && video && video.readyState >= 2) {
      try {
        const now = performance.now();
        const rawMs = video.currentTime > 0 ? video.currentTime * 1000 : now;
        const ts = Math.max(Math.round(rawMs), lastMpTsRef.current + 1);
        lastMpTsRef.current = ts;
        const result = lm.detectForVideo(video, ts);
        if (result.faceLandmarks?.[0]) {
          const marks = result.faceLandmarks[0];
          const ear = (eyeAspectRatio(marks, LEFT_EYE) + eyeAspectRatio(marks, RIGHT_EYE)) / 2;
          const rollingBpm = blinkTimesRef.current.filter((t) => now - t <= 60_000).length;
          pushSample(now, totalBlinksRef.current, rollingBpm, ear);
        }
      } catch {
        /* ignore */
      }
    }

    videoRef.current = null;
    const elapsedMs = performance.now() - sessionStartRef.current;
    const elapsedMin = Math.max(elapsedMs / 60000, 1 / 60);
    const totalBlinks = totalBlinksRef.current;
    const avg = totalBlinks / elapsedMin;
    const roundedAvg = Math.round(avg * 10) / 10;
    const minB = minBpmRef.current === Infinity ? roundedAvg : minBpmRef.current;
    const maxB = maxBpmRef.current;

    return {
      blinkCount: totalBlinks,
      bpm: Math.round(avg * 10) / 10,
      avgBpmSession: roundedAvg,
      minBpm: Math.round(minB * 10) / 10,
      maxBpm: Math.round(maxB * 10) / 10,
      status: statusFromBpm(roundedAvg),
      samples: [...samplesRef.current],
    };
  }, [pushSample]);

  const resetModel = useCallback(() => {
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    setIsReady(false);
  }, []);

  return {
    initLandmarker,
    resetModel,
    start,
    stop,
    isReady,
    isRunning,
    error,
    blinkCount,
    bpm,
    avgBpmSession,
    faceDetected,
    avgEar,
  };
}

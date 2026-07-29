/**
 * Dry-eye risk analysis engine.
 *
 * Turns stored monitoring sessions into a 0-100 dry-eye risk index plus the evidence
 * behind it. Everything in this file is pure — `analyzeSessions()` does no I/O — so it
 * is unit-testable (analysis.test.mjs) and reusable from any route.
 *
 * Why an explainable rule model instead of a trained one: the prototype holds a few
 * hundred samples from a handful of devices, which is far too little to fit anything.
 * The rules below encode recognised dry-eye markers for screen work (suppressed blink
 * rate, long blink-free "staring" intervals, blink rate decaying during a session) so
 * every point of the score can be traced back to a number the user can see.
 *
 * Three quirks of the stored data drive most of the guard rails here — read these
 * before touching the weights:
 *
 *  1. `SamplePoint.bpm` is a raw count of blinks in the trailing 60 s window
 *     (useBlinkTracker.ts). Samples taken before t = 60 s therefore always under-report,
 *     which is why exposure/decline features ignore them (WARMUP_SEC).
 *  2. `SessionRecord.avgBlinksPerMin` is blinkCount / elapsed minutes — unbiased at any
 *     duration — so it drives the primary factor, weighted by session length.
 *  3. Because of (1) almost every session logs one dryness alert in its first minute.
 *     Only *excess* alerts (beyond the first) on sessions long enough to leave the
 *     warm-up count towards risk.
 */

export const ANALYSIS_MODEL_VERSION = "pipo-dry-eye-heuristic-1.0";

/** Rolling-window warm-up: samples before this are statistically biased low. */
const WARMUP_SEC = 60;
/** Sessions shorter/sparser than this are noise (aborted captures, tracking never locked on). */
const MIN_DURATION_MS = 15_000;
const MIN_SAMPLES = 3;
/** A stretch with no blink at all that is longer than this counts as a "staring" gap. */
const GAP_SEC = 10;
/** Alerts only count on sessions long enough that the warm-up artefact is not the whole story. */
const ALERT_MIN_DURATION_MS = 90_000;

export const DEFAULT_OPTIONS = {
  /** Analysis window in days. */
  windowDays: 14,
  /** If the window is empty, fall back to this many most recent usable sessions. */
  fallbackSessionCount: 10,
};

/**
 * Relative pull of each factor on the final score. Factors that cannot be computed
 * (not enough data) are dropped and the remaining weights are re-normalised.
 */
export const FACTOR_WEIGHTS = {
  blinkRate: 34,
  lowRateExposure: 22,
  blinkFreeGaps: 18,
  alertBurden: 10,
  withinSessionDecline: 10,
  betweenSessionTrend: 6,
};

/** Findings are listed worst-first, so this ranks the severity buckets. */
const SEVERITY_RANK = { risk: 2, watch: 1, good: 0 };

const LEVELS = [
  { key: "minimal", max: 20, label: "Low risk" },
  { key: "mild", max: 40, label: "Mild indicators" },
  { key: "moderate", max: 65, label: "Moderate indicators" },
  { key: "high", max: Infinity, label: "High indicators" },
];

/* ------------------------------------------------------------------ helpers */

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** 0 at `from`, 1 at `to`. Works in both directions (to may be lower than from). */
function ramp(value, from, to) {
  if (from === to) return value >= to ? 1 : 0;
  return clamp01((value - from) / (to - from));
}

function round(n, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function severityFor(score) {
  if (score < 0.25) return "good";
  if (score < 0.55) return "watch";
  return "risk";
}

function durationOf(session) {
  const d = Number(session.durationMs);
  if (Number.isFinite(d) && d > 0) return d;
  return Math.max(0, Number(session.endedAt) - Number(session.startedAt));
}

function samplesOf(session) {
  return Array.isArray(session.samples) ? session.samples : [];
}

function isUsable(session) {
  if (!session || typeof session !== "object") return false;
  if (!Number.isFinite(Number(session.startedAt))) return false;
  if (!Number.isFinite(Number(session.avgBlinksPerMin))) return false;
  return durationOf(session) >= MIN_DURATION_MS && samplesOf(session).length >= MIN_SAMPLES;
}

/** Least-squares slope of y over x. Returns 0 when x has no spread. */
function slope(points) {
  const n = points.length;
  if (n < 2) return 0;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of points) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  return den < 1e-9 ? 0 : num / den;
}

/* ---------------------------------------------------------- session picking */

/**
 * Pick the sessions the analysis runs on: usable sessions inside the window, or the
 * most recent usable ones when the window is empty (so a returning user still gets a
 * read-out instead of an empty state).
 */
export function selectSessions(sessions, options = {}) {
  const { windowDays, fallbackSessionCount } = { ...DEFAULT_OPTIONS, ...options };
  const now = Number(options.now) || Date.now();
  const list = Array.isArray(sessions) ? sessions : [];

  const usable = list.filter(isUsable).sort((a, b) => a.startedAt - b.startedAt);
  const from = now - windowDays * 86_400_000;

  let used = usable.filter((s) => s.startedAt >= from);
  let extended = false;

  if (used.length === 0 && usable.length > 0) {
    used = usable.slice(-fallbackSessionCount);
    extended = true;
  }

  const rangeStart = used.length ? Math.min(from, used[0].startedAt) : from;
  const excluded = list.filter((s) => !isUsable(s) && Number(s.startedAt) >= rangeStart).length;

  return { used, excluded, extended, from: rangeStart, to: now };
}

/* ---------------------------------------------------------------- factors */

/** Factor 1 — how far the duration-weighted mean blink rate sits below a healthy cadence. */
function blinkRateFactor(sessions) {
  let weighted = 0;
  let totalMs = 0;
  for (const s of sessions) {
    const ms = durationOf(s);
    weighted += Number(s.avgBlinksPerMin) * ms;
    totalMs += ms;
  }
  if (totalMs === 0) return { available: false };

  const mean = weighted / totalMs;
  let score;
  if (mean >= 15) score = 0;
  else if (mean >= 10) score = ramp(mean, 15, 10) * 0.4;
  else if (mean >= 7) score = 0.4 + ramp(mean, 10, 7) * 0.3;
  else score = 0.7 + ramp(mean, 7, 3) * 0.3;

  return {
    available: true,
    score: clamp01(score),
    mean: round(mean),
    value: `${round(mean)} blinks/min`,
    detail:
      mean >= 15
        ? "Comfortably inside the 15-20 blinks/min range healthy eyes hold during screen work."
        : mean >= 10
          ? "Slightly under the 15 blinks/min a relaxed eye keeps — typical mild screen-induced blink suppression."
          : mean >= 7
            ? "Well under a healthy cadence. The tear film gets less than half the resurfacing it needs."
            : "Below the 7 blinks/min dryness threshold on average — the strongest single marker in this model.",
  };
}

/** Factor 2 — share of monitored time spent under the dryness thresholds. */
function lowRateExposureFactor(sessions) {
  let total = 0;
  let below7 = 0;
  let below10 = 0;

  for (const s of sessions) {
    for (const p of samplesOf(s)) {
      if (!Number.isFinite(p.t) || p.t < WARMUP_SEC) continue; // rolling window still filling
      total += 1;
      if (p.bpm < 7) below7 += 1;
      if (p.bpm < 10) below10 += 1;
    }
  }
  if (total < 6) return { available: false, samples: total };

  const frac7 = below7 / total;
  const frac10 = below10 / total;
  const score = clamp01(0.75 * (frac7 / 0.35) + 0.25 * (frac10 / 0.6));
  const pct = round(frac7 * 100, 0);

  return {
    available: true,
    score,
    samples: total,
    pctBelow7: pct,
    pctBelow10: round(frac10 * 100, 0),
    value: `${pct}% of the time under 7/min`,
    detail:
      frac7 < 0.05
        ? "Blink cadence almost never dropped into the dryness band during steady monitoring."
        : `${pct}% of measured time sat below 7 blinks/min and ${round(frac10 * 100, 0)}% below 10 — sustained dips are what dries the tear film.`,
  };
}

/** Factor 3 — long blink-free stretches, the "staring at the screen" signature. */
function blinkFreeGapFactor(sessions) {
  let longest = 0;
  let gapCount = 0;
  let monitoredMin = 0;

  for (const s of sessions) {
    const samples = samplesOf(s).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.cumBlinks));
    if (samples.length < 2) continue;
    monitoredMin += durationOf(s) / 60_000;

    // Merge consecutive zero-blink intervals into one contiguous gap. Intervals are
    // measured between two real samples, so a late first sample (face not detected yet)
    // never counts as a gap.
    let run = 0;
    for (let i = 1; i < samples.length; i++) {
      const dt = samples[i].t - samples[i - 1].t;
      const blinks = samples[i].cumBlinks - samples[i - 1].cumBlinks;
      if (dt <= 0 || dt > 30) {
        run = 0;
        continue;
      }
      if (blinks <= 0) {
        run += dt;
        if (run > longest) longest = run;
      } else {
        if (run >= GAP_SEC) gapCount += 1;
        run = 0;
      }
    }
    if (run >= GAP_SEC) gapCount += 1;
  }

  if (monitoredMin <= 0) return { available: false };

  const gapsPerMin = gapCount / monitoredMin;
  const score = clamp01(0.6 * ramp(longest, 6, 20) + 0.4 * clamp01(gapsPerMin / 1.5));

  return {
    available: true,
    score,
    longestSec: round(longest),
    gapsPerMin: round(gapsPerMin, 2),
    value: `${round(longest)}s longest without a blink`,
    detail:
      longest < 8
        ? "No long staring stretches — blinks stayed evenly spaced."
        : `Longest measured stretch without a single blink was ${round(longest)}s, and gaps over ${GAP_SEC}s occurred about ${round(gapsPerMin, 2)} times per minute. Each one leaves the cornea exposed.`,
  };
}

/** Factor 4 — dryness alerts beyond the unavoidable warm-up one. */
function alertBurdenFactor(sessions) {
  let excess = 0;
  let minutes = 0;
  for (const s of sessions) {
    const ms = durationOf(s);
    if (ms < ALERT_MIN_DURATION_MS) continue;
    minutes += ms / 60_000;
    excess += Math.max(0, Number(s.alertsTriggered || 0) - 1);
  }
  if (minutes < 3) return { available: false };

  const per10 = excess / (minutes / 10);
  const score = clamp01(per10 / 3);

  return {
    available: true,
    score,
    per10Min: round(per10, 2),
    excess,
    value: `${round(per10, 2)} alerts / 10 min`,
    detail:
      excess === 0
        ? "No repeat dryness alerts once a session settled into its rhythm."
        : `${excess} dryness alert(s) fired after the first one, i.e. about ${round(per10, 2)} per 10 minutes of monitoring.`,
  };
}

/** Factor 5 — blink rate decaying as a session goes on (tear-film fatigue). */
function withinSessionDeclineFactor(sessions) {
  let weighted = 0;
  let totalMs = 0;

  for (const s of sessions) {
    const pts = samplesOf(s)
      .filter((p) => Number.isFinite(p.t) && p.t >= WARMUP_SEC && Number.isFinite(p.bpm))
      .map((p) => [p.t / 60, p.bpm]);
    if (pts.length < 4) continue;
    const ms = durationOf(s);
    weighted += slope(pts) * ms;
    totalMs += ms;
  }
  if (totalMs === 0) return { available: false };

  const perMin = weighted / totalMs; // blinks/min lost per minute of screen time
  const score = clamp01(-perMin / 6);

  return {
    available: true,
    score,
    slopePerMin: round(perMin),
    value: `${perMin <= 0 ? "" : "+"}${round(perMin)} /min per minute`,
    detail:
      perMin >= -1.5
        ? "Blink cadence held steady (or improved) the longer a session ran."
        : `Blink rate fell by about ${round(-perMin)} blinks/min for every extra minute of screen time — a classic fatigue curve.`,
  };
}

/** Factor 6 — is the recent half of the window worse than the earlier half? */
function trendFactor(sessions) {
  if (sessions.length < 4) return { available: false };

  const half = Math.floor(sessions.length / 2);
  const meanOf = (list) => {
    let w = 0;
    let ms = 0;
    for (const s of list) {
      const d = durationOf(s);
      w += Number(s.avgBlinksPerMin) * d;
      ms += d;
    }
    return ms ? w / ms : 0;
  };

  const earlier = meanOf(sessions.slice(0, half));
  const recent = meanOf(sessions.slice(half));
  if (earlier <= 0) return { available: false };

  const changePct = ((recent - earlier) / earlier) * 100;
  const score = clamp01(-changePct / 30);

  return {
    available: true,
    score,
    changePct: round(changePct, 0),
    earlier: round(earlier),
    recent: round(recent),
    value: `${changePct >= 0 ? "+" : ""}${round(changePct, 0)}% vs earlier sessions`,
    detail:
      changePct >= 0
        ? `Recent sessions average ${round(recent)} blinks/min against ${round(earlier)} earlier — holding or improving.`
        : `Recent sessions average ${round(recent)} blinks/min, down from ${round(earlier)} earlier in the window.`,
  };
}

/* ------------------------------------------------------------- narrative */

function levelFor(riskScore) {
  return LEVELS.find((l) => riskScore < l.max) || LEVELS[LEVELS.length - 1];
}

function summaryFor(levelKey, topFinding) {
  const driver = topFinding ? ` Main driver: ${topFinding.label.toLowerCase()}.` : "";
  switch (levelKey) {
    case "minimal":
      return `Your blink behaviour looks healthy — no meaningful dry-eye indicators in this window.${driver}`;
    case "mild":
      return `A few early dry-eye indicators showed up, nothing alarming yet.${driver}`;
    case "moderate":
      return `Several dry-eye indicators appear consistently across your sessions.${driver}`;
    default:
      return `Strong dry-eye indicators across your recent sessions.${driver}`;
  }
}

function recommendationsFor(levelKey, byKey) {
  const out = [];
  const risky = (key, at = 0.35) => byKey[key]?.available && byKey[key].score >= at;

  if (levelKey === "high" || levelKey === "moderate") {
    out.push({
      title: "Consider an eye-care professional",
      detail:
        "Persistent low blink rates plus gritty, burning or watery eyes are worth a proper tear-film assessment. This app cannot diagnose you.",
    });
  }
  if (risky("blinkRate")) {
    out.push({
      title: "Practise complete blinks",
      detail: "Every 20 minutes, close your eyes fully and slowly 5 times. Full closures resurface the tear film; half blinks do not.",
    });
  }
  if (risky("blinkFreeGaps")) {
    out.push({
      title: "Break the stare — 20-20-20",
      detail: "Every 20 minutes look at something 20 feet (6 m) away for 20 seconds. Refocusing restarts your natural blink rhythm.",
    });
  }
  if (risky("lowRateExposure")) {
    out.push({
      title: "Drop the screen below eye level",
      detail: "A screen slightly below eye height narrows the eye opening and cuts tear evaporation. Avoid fans or vents blowing at your face.",
    });
  }
  if (risky("withinSessionDecline")) {
    out.push({
      title: "Cap continuous screen blocks",
      detail: "Your blink rate decays the longer you stay on screen. Keep uninterrupted blocks under ~45 minutes and stand up between them.",
    });
  }
  if (risky("alertBurden")) {
    out.push({
      title: "Act on dryness alerts",
      detail: "When the alert fires, blink slowly 5 times and look away before dismissing it — that is what resets the tear film.",
    });
  }
  if (out.length === 0) {
    out.push({
      title: "Keep your current rhythm",
      detail: "Whatever you are doing works. Keep the 20-20-20 habit and stay hydrated, especially in air-conditioned rooms.",
    });
  }
  out.push({
    title: "Keep monitoring",
    detail: "Two or three captures a week of at least two minutes each keep this analysis meaningful and let it spot trends early.",
  });

  return out.slice(0, 4);
}

/* ---------------------------------------------------------------- public */

/**
 * Analyse stored sessions and return a dry-eye risk read-out.
 *
 * @param {Array} sessions Stored SessionRecord objects (any order).
 * @param {{windowDays?: number, fallbackSessionCount?: number, now?: number}} [options]
 */
export function analyzeSessions(sessions, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = Number(options.now) || Date.now();
  const picked = selectSessions(sessions, { ...opts, now });
  const used = picked.used;

  const base = {
    generatedAt: now,
    modelVersion: ANALYSIS_MODEL_VERSION,
    window: {
      days: opts.windowDays,
      from: picked.from,
      to: picked.to,
      extended: picked.extended,
    },
    disclaimer:
      "Automated wellness screening from your own blink statistics — not a medical diagnosis. Pipo Care is not a medical device.",
  };

  if (used.length === 0) {
    return {
      ...base,
      state: "insufficient_data",
      riskScore: null,
      level: null,
      levelLabel: "Not enough data",
      summary:
        "Run a monitoring session of at least 15 seconds (a couple of minutes gives a much better read) and the analysis will appear here.",
      confidence: { score: 0, label: "none" },
      coverage: {
        sessionsAnalyzed: 0,
        sessionsExcluded: picked.excluded,
        monitoredMinutes: 0,
        totalBlinks: 0,
        samplesAnalyzed: 0,
      },
      metrics: {},
      findings: [],
      recommendations: [
        {
          title: "Start your first capture",
          detail: "Open Monitor, allow the camera and let it run for two minutes while you work normally.",
        },
      ],
    };
  }

  const factors = {
    blinkRate: { label: "Average blink rate", ...blinkRateFactor(used) },
    lowRateExposure: { label: "Time in the dryness band", ...lowRateExposureFactor(used) },
    blinkFreeGaps: { label: "Blink-free staring gaps", ...blinkFreeGapFactor(used) },
    alertBurden: { label: "Repeat dryness alerts", ...alertBurdenFactor(used) },
    withinSessionDecline: { label: "Blink decay during sessions", ...withinSessionDeclineFactor(used) },
    betweenSessionTrend: { label: "Trend vs earlier sessions", ...trendFactor(used) },
  };

  let weightSum = 0;
  let weighted = 0;
  for (const [key, f] of Object.entries(factors)) {
    if (!f.available) continue;
    weightSum += FACTOR_WEIGHTS[key];
    weighted += FACTOR_WEIGHTS[key] * f.score;
  }
  const riskScore = weightSum > 0 ? Math.round((weighted / weightSum) * 100) : 0;
  const level = levelFor(riskScore);

  const findings = Object.entries(factors)
    .filter(([, f]) => f.available)
    .map(([key, f]) => ({
      key,
      label: f.label,
      severity: severityFor(f.score),
      value: f.value,
      detail: f.detail,
      weight: round((FACTOR_WEIGHTS[key] / weightSum) * 100, 0),
      impact: round((FACTOR_WEIGHTS[key] * f.score) / weightSum * 100),
    }))
    .sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        b.impact - a.impact ||
        b.weight - a.weight
    );

  const monitoredMinutes = used.reduce((acc, s) => acc + durationOf(s), 0) / 60_000;
  const totalBlinks = used.reduce((acc, s) => acc + (Number(s.blinkCount) || 0), 0);
  const samplesAnalyzed = used.reduce((acc, s) => acc + samplesOf(s).length, 0);

  const confidenceScore = clamp01(
    0.5 * Math.min(1, used.length / 6) + 0.5 * Math.min(1, monitoredMinutes / 20)
  );
  const confidenceLabel = confidenceScore < 0.4 ? "low" : confidenceScore < 0.75 ? "moderate" : "high";

  return {
    ...base,
    state: "ok",
    riskScore,
    level: level.key,
    levelLabel: level.label,
    summary: summaryFor(level.key, findings.find((f) => f.severity !== "good")),
    confidence: { score: round(confidenceScore, 2), label: confidenceLabel },
    coverage: {
      sessionsAnalyzed: used.length,
      sessionsExcluded: picked.excluded,
      monitoredMinutes: round(monitoredMinutes),
      totalBlinks,
      samplesAnalyzed,
    },
    metrics: {
      avgBlinksPerMin: factors.blinkRate.available ? factors.blinkRate.mean : null,
      pctTimeBelow7: factors.lowRateExposure.available ? factors.lowRateExposure.pctBelow7 : null,
      longestBlinkFreeSec: factors.blinkFreeGaps.available ? factors.blinkFreeGaps.longestSec : null,
      trendPct: factors.betweenSessionTrend.available ? factors.betweenSessionTrend.changePct : null,
    },
    findings,
    recommendations: recommendationsFor(level.key, factors),
  };
}

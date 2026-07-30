/**
 * Unit tests for the dry-eye analysis engine.
 *
 *   node --test          (from the server/ folder)
 *   npm test --prefix server
 */
import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSessions, selectSessions } from "./analysis.js";

const NOW = Date.UTC(2026, 6, 29, 12, 0, 0); // fixed clock: the engine takes `now` as input

/**
 * Build a synthetic session with an even blink cadence.
 * @param {{bpm: number, minutes?: number, ago?: number, alerts?: number, decayPerMin?: number}} spec
 */
function session(spec) {
  const { bpm, minutes = 3, ago = 1, alerts = 1, decayPerMin = 0 } = spec;
  const durationMs = minutes * 60_000;
  const startedAt = NOW - ago * 86_400_000;
  const samples = [];
  let cum = 0;
  for (let t = 5; t <= minutes * 60; t += 5) {
    const rate = Math.max(0, bpm - (decayPerMin * t) / 60);
    cum = Math.round((rate * t) / 60);
    samples.push({ t, bpm: t < 60 ? Math.round((rate * t) / 60) : Math.round(rate), cumBlinks: cum, avgEar: 0.3, status: "healthy" });
  }
  return {
    id: `s-${ago}-${bpm}`,
    startedAt,
    endedAt: startedAt + durationMs,
    durationMs,
    blinkCount: cum,
    avgBlinksPerMin: bpm,
    minBpm: 0,
    maxBpm: bpm,
    status: "healthy",
    samples,
    alertsTriggered: alerts,
  };
}

test("no sessions at all yields the insufficient-data state", () => {
  const a = analyzeSessions([], { now: NOW });
  assert.equal(a.state, "insufficient_data");
  assert.equal(a.riskScore, null);
  assert.ok(a.recommendations.length > 0);
});

test("junk captures are filtered out, not scored", () => {
  const junk = [
    { id: "a", startedAt: NOW - 1000, endedAt: NOW, durationMs: 3000, blinkCount: 0, avgBlinksPerMin: 0, status: "dry", samples: [], alertsTriggered: 0 },
    { id: "b", startedAt: NOW - 2000, endedAt: NOW, durationMs: 0, blinkCount: 0, avgBlinksPerMin: 0, status: "dry", samples: [{ t: 0, bpm: 0, cumBlinks: 0, status: "dry" }], alertsTriggered: 0 },
  ];
  const picked = selectSessions(junk, { windowDays: 14, now: NOW });
  assert.equal(picked.used.length, 0);
  assert.equal(picked.excluded, 2);

  const a = analyzeSessions(junk, { now: NOW });
  assert.equal(a.state, "insufficient_data");
  assert.equal(a.coverage.sessionsExcluded, 2);
});

test("healthy blink behaviour scores low risk", () => {
  const sessions = [1, 3, 5, 7].map((ago) => session({ bpm: 18, ago, alerts: 1 }));
  const a = analyzeSessions(sessions, { now: NOW });
  assert.equal(a.state, "ok");
  assert.equal(a.level, "minimal");
  assert.ok(a.riskScore < 20, `expected < 20, got ${a.riskScore}`);
  assert.equal(a.findings.find((f) => f.key === "blinkRate").severity, "good");
});

test("chronically suppressed blinking scores high risk", () => {
  const sessions = [1, 2, 4, 6].map((ago) => session({ bpm: 4, ago, alerts: 4 }));
  const a = analyzeSessions(sessions, { now: NOW });
  assert.equal(a.level, "high");
  assert.ok(a.riskScore >= 65, `expected >= 65, got ${a.riskScore}`);
  const top = a.findings[0];
  assert.equal(top.key, "blinkRate");
  assert.equal(top.severity, "risk");
  assert.ok(a.recommendations.some((r) => /eye-care professional/i.test(r.title)));
});

test("borderline blinking lands between the two extremes", () => {
  const healthy = analyzeSessions([1, 3, 5, 7].map((ago) => session({ bpm: 18, ago })), { now: NOW }).riskScore;
  const borderline = analyzeSessions([1, 3, 5, 7].map((ago) => session({ bpm: 9, ago })), { now: NOW }).riskScore;
  const dry = analyzeSessions([1, 3, 5, 7].map((ago) => session({ bpm: 4, ago })), { now: NOW }).riskScore;
  assert.ok(healthy < borderline && borderline < dry, `${healthy} < ${borderline} < ${dry}`);
});

test("warm-up samples never count as time in the dryness band", () => {
  // A single healthy session: the first minute of rolling-window samples reads low by design.
  const a = analyzeSessions([session({ bpm: 20, minutes: 3, ago: 1 })], { now: NOW });
  const exposure = a.findings.find((f) => f.key === "lowRateExposure");
  assert.ok(exposure, "exposure factor should be available for a 3-minute session");
  assert.equal(exposure.severity, "good");
  assert.equal(a.metrics.pctTimeBelow7, 0);
});

test("only excess alerts count, so one warm-up alert per session is harmless", () => {
  const one = analyzeSessions([1, 2, 3, 4].map((ago) => session({ bpm: 18, ago, alerts: 1 })), { now: NOW });
  const many = analyzeSessions([1, 2, 3, 4].map((ago) => session({ bpm: 18, ago, alerts: 5 })), { now: NOW });
  assert.equal(one.findings.find((f) => f.key === "alertBurden").impact, 0);
  assert.ok(many.riskScore > one.riskScore);
});

test("a decaying blink rate inside sessions raises the fatigue factor", () => {
  const flat = analyzeSessions([1, 2, 3].map((ago) => session({ bpm: 18, minutes: 5, ago })), { now: NOW });
  const decaying = analyzeSessions(
    [1, 2, 3].map((ago) => session({ bpm: 18, minutes: 5, ago, decayPerMin: 3 })),
    { now: NOW }
  );
  const flatDecline = flat.findings.find((f) => f.key === "withinSessionDecline");
  const decayDecline = decaying.findings.find((f) => f.key === "withinSessionDecline");
  assert.equal(flatDecline.severity, "good");
  assert.ok(decayDecline.impact > flatDecline.impact);
});

test("long blink-free stretches are detected from cumulative counts", () => {
  const s = session({ bpm: 12, minutes: 3, ago: 1 });
  // Freeze the blink counter for 30 s in the middle of the session.
  const freezeFrom = 12;
  const frozenAt = s.samples[freezeFrom].cumBlinks;
  for (let i = freezeFrom; i < freezeFrom + 6; i++) s.samples[i].cumBlinks = frozenAt;
  const a = analyzeSessions([s], { now: NOW });
  const gaps = a.findings.find((f) => f.key === "blinkFreeGaps");
  assert.ok(a.metrics.longestBlinkFreeSec >= 25, `got ${a.metrics.longestBlinkFreeSec}`);
  assert.equal(gaps.severity, "risk");
});

test("a worsening trend is reported and pushes the score up", () => {
  const improving = analyzeSessions(
    [{ ago: 8, bpm: 10 }, { ago: 6, bpm: 11 }, { ago: 3, bpm: 17 }, { ago: 1, bpm: 18 }].map(session),
    { now: NOW }
  );
  const worsening = analyzeSessions(
    [{ ago: 8, bpm: 18 }, { ago: 6, bpm: 17 }, { ago: 3, bpm: 11 }, { ago: 1, bpm: 10 }].map(session),
    { now: NOW }
  );
  assert.ok(improving.metrics.trendPct > 0);
  assert.ok(worsening.metrics.trendPct < 0);
  assert.ok(worsening.findings.find((f) => f.key === "betweenSessionTrend").impact > 0);
});

test("an empty window falls back to the most recent usable sessions", () => {
  const old = [40, 45, 50].map((ago) => session({ bpm: 18, ago }));
  const a = analyzeSessions(old, { now: NOW, windowDays: 14 });
  assert.equal(a.state, "ok");
  assert.equal(a.window.extended, true);
  assert.equal(a.coverage.sessionsAnalyzed, 3);
});

test("confidence grows with session count and monitored minutes", () => {
  const thin = analyzeSessions([session({ bpm: 18, minutes: 1, ago: 1 })], { now: NOW });
  const rich = analyzeSessions(
    [1, 2, 3, 4, 5, 6].map((ago) => session({ bpm: 18, minutes: 5, ago })),
    { now: NOW }
  );
  assert.equal(thin.confidence.label, "low");
  assert.equal(rich.confidence.label, "high");
  assert.ok(rich.confidence.score > thin.confidence.score);
});

/* ------------------------------------------- onboarding self-report factor */

/** @param {{dryness: number, strain: number, relief: number, screens?: number, reason?: string}} a */
function profile(a) {
  return {
    id: "u1",
    displayName: "Tester",
    onboarding: {
      completed: true,
      primaryReason: a.reason || "prevention",
      scales: {
        drynessDiscomfort: a.dryness,
        visionStrain: a.strain,
        reliefUse: a.relief,
        screenHours: a.screens ?? 3,
      },
    },
  };
}

test("without onboarding answers the self-report factor is simply absent", () => {
  const sessions = [1, 3, 5].map((ago) => session({ bpm: 18, ago }));
  const a = analyzeSessions(sessions, { now: NOW });
  assert.equal(a.usesProfile, false);
  assert.equal(a.findings.find((f) => f.key === "selfReported"), undefined);
  assert.equal(a.metrics.selfReportedSymptoms, null);
  // An unscored profile must not change the measured verdict.
  const withEmpty = analyzeSessions(sessions, { now: NOW, profile: { id: "u1", onboarding: { completed: false } } });
  assert.equal(withEmpty.riskScore, a.riskScore);
});

test("reported symptoms raise the score even when blink mechanics look fine", () => {
  const sessions = [1, 3, 5].map((ago) => session({ bpm: 18, ago }));
  const calm = analyzeSessions(sessions, { now: NOW, profile: profile({ dryness: 1, strain: 1, relief: 1 }) });
  const suffering = analyzeSessions(sessions, { now: NOW, profile: profile({ dryness: 5, strain: 5, relief: 5, screens: 5 }) });

  assert.equal(calm.usesProfile, true);
  assert.equal(calm.findings.find((f) => f.key === "selfReported").severity, "good");
  assert.equal(suffering.findings.find((f) => f.key === "selfReported").severity, "risk");
  assert.ok(suffering.riskScore > calm.riskScore, `${suffering.riskScore} should exceed ${calm.riskScore}`);
  assert.equal(suffering.metrics.selfReportedSymptoms, 5);
});

test("symptoms with a healthy blink rate produce the evaporative-cause advice", () => {
  const sessions = [1, 3, 5].map((ago) => session({ bpm: 18, ago }));
  const a = analyzeSessions(sessions, { now: NOW, profile: profile({ dryness: 5, strain: 4, relief: 5 }) });
  assert.ok(a.recommendations.some((r) => /Symptoms without a blink problem/.test(r.title)));
});

test("self-report cannot outweigh the measured factors on its own", () => {
  // Worst possible self-report over healthy measurements must stay below the "high" band.
  const sessions = [1, 3, 5, 7].map((ago) => session({ bpm: 18, ago, alerts: 1 }));
  const a = analyzeSessions(sessions, { now: NOW, profile: profile({ dryness: 5, strain: 5, relief: 5, screens: 5 }) });
  assert.ok(a.riskScore < 40, `self-report alone should not reach moderate, got ${a.riskScore}`);
  assert.ok(a.findings.find((f) => f.key === "selfReported").weight <= 15);
});

test("the stated reason tailors the closing recommendation", () => {
  const sessions = [1, 3, 5].map((ago) => session({ bpm: 18, ago }));
  const clinical = analyzeSessions(sessions, {
    now: NOW,
    profile: profile({ dryness: 2, strain: 2, relief: 1, reason: "professional" }),
  });
  const casual = analyzeSessions(sessions, {
    now: NOW,
    profile: profile({ dryness: 2, strain: 2, relief: 1, reason: "curiosity" }),
  });
  assert.ok(clinical.recommendations.some((r) => /Bring this to your appointment/.test(r.title)));
  assert.ok(casual.recommendations.some((r) => /Keep monitoring/.test(r.title)));
});

test("partial or malformed onboarding answers are ignored rather than scored", () => {
  const sessions = [1, 3, 5].map((ago) => session({ bpm: 18, ago }));
  const partial = { id: "u1", onboarding: { completed: true, scales: { drynessDiscomfort: 4 } } };
  const a = analyzeSessions(sessions, { now: NOW, profile: partial });
  assert.equal(a.usesProfile, false);
});

test("factor weights are re-normalised when factors are unavailable", () => {
  // A single 20 s session: too short for exposure, alert, decline and trend factors.
  const short = session({ bpm: 18, minutes: 1, ago: 1 });
  short.durationMs = 20_000;
  short.endedAt = short.startedAt + 20_000;
  short.samples = short.samples.slice(0, 4);
  const a = analyzeSessions([short], { now: NOW });
  assert.equal(a.state, "ok");
  const total = a.findings.reduce((acc, f) => acc + f.weight, 0);
  assert.ok(Math.abs(total - 100) <= 2, `weights should still sum to ~100, got ${total}`);
});

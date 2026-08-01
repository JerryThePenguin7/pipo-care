/**
 * The onboarding questionnaire — single source of truth.
 *
 * The client renders these questions from GET /api/onboarding/schema rather than
 * hard-coding the wording, and the analysis engine reads the stored answers as one
 * more scoring factor (see analysis.js → selfReportFactor).
 *
 * The scale items are deliberately close to the kind of statements used by dry-eye
 * symptom questionnaires (OSDI / DEQ-5): frequency and intensity of discomfort,
 * screen exposure, and whether the user already reaches for relief. That keeps the
 * self-reported half of the score comparable to the measured half.
 */

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;

/** Answered 1-5. `weight` is the pull inside the self-report factor (must sum to 1). */
export const SCALE_QUESTIONS = [
  {
    id: "drynessDiscomfort",
    text: "My eyes feel dry, gritty or tired during the day",
    low: "Never",
    high: "All day",
    weight: 0.4,
  },
  {
    id: "visionStrain",
    text: "My vision blurs or my eyes ache after screen work",
    low: "Never",
    high: "Constantly",
    weight: 0.3,
  },
  {
    id: "reliefUse",
    text: "I use eye drops, or stop working, to get relief",
    low: "Never",
    high: "Several times a day",
    weight: 0.3,
  },
  {
    id: "screenHours",
    text: "I spend most of my waking hours looking at a screen",
    low: "Rarely",
    high: "Almost always",
    weight: 0, // exposure context, scored separately from the symptom items
  },
];

export const PRIMARY_REASONS = [
  {
    id: "symptoms",
    label: "My eyes already bother me",
    detail: "Dryness, burning or tired eyes I want to understand.",
  },
  {
    id: "prevention",
    label: "I want to prevent problems",
    detail: "Long screen days, no real symptoms yet.",
  },
  {
    id: "professional",
    label: "An eye-care professional suggested it",
    detail: "I am tracking something a clinician raised with me.",
  },
  {
    id: "curiosity",
    label: "I am curious about my blink habits",
    detail: "Mostly here for the data.",
  },
];

export function onboardingSchema() {
  return {
    scaleMin: SCALE_MIN,
    scaleMax: SCALE_MAX,
    questions: SCALE_QUESTIONS.map(({ id, text, low, high }) => ({ id, text, low, high })),
    reasons: PRIMARY_REASONS,
  };
}

/**
 * Validate an onboarding submission.
 * @returns {{error: string} | {value: object}}
 */
export function validateOnboarding(body) {
  if (!body || typeof body !== "object") return { error: "Invalid body" };

  const reason = String(body.primaryReason || "");
  if (!PRIMARY_REASONS.some((r) => r.id === reason)) return { error: "Unknown primaryReason" };

  const scales = {};
  for (const q of SCALE_QUESTIONS) {
    const raw = body.scales?.[q.id];
    const n = Number(raw);
    if (!Number.isInteger(n) || n < SCALE_MIN || n > SCALE_MAX) {
      return { error: `Answer for "${q.id}" must be an integer ${SCALE_MIN}-${SCALE_MAX}` };
    }
    scales[q.id] = n;
  }

  return {
    value: {
      completed: true,
      completedAt: Date.now(),
      primaryReason: reason,
      scales,
    },
  };
}

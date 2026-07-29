export type EyeStatus = "healthy" | "medium" | "slightly_dry" | "dry";

/* ------------------------------------------------------- accounts & setup */

export type ThemeChoice = "light" | "dark";

/** Answers collected during first-run onboarding; they feed the AI analysis. */
export type Onboarding = {
  completed: boolean;
  completedAt?: number;
  primaryReason?: string;
  scales?: Record<string, number>;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  theme: ThemeChoice;
  provider: "google" | "dev";
  onboarding: Onboarding;
  createdAt: number;
  lastLoginAt: number;
};

export type AuthConfig = {
  googleClientId: string;
  devLoginEnabled: boolean;
};

export type OnboardingSchema = {
  scaleMin: number;
  scaleMax: number;
  questions: { id: string; text: string; low: string; high: string }[];
  reasons: { id: string; label: string; detail: string }[];
};

export type SamplePoint = {
  t: number;
  bpm: number;
  cumBlinks: number;
  avgEar?: number;
  status: EyeStatus;
};

export type SessionRecord = {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  blinkCount: number;
  avgBlinksPerMin: number;
  minBpm: number | null;
  maxBpm: number | null;
  status: EyeStatus;
  samples: SamplePoint[];
  alertsTriggered: number;
  notes?: string;
  createdAt?: number;
};

/* ---------------------------------------------------- AI dry-eye analysis */

/** How strongly one factor pushed the risk score. Mirrors server/analysis.js. */
export type AnalysisFinding = {
  key: string;
  label: string;
  severity: "good" | "watch" | "risk";
  value: string;
  detail: string;
  /** Share of the score this factor could influence, in percent. */
  weight: number;
  /** Points of the 0-100 score this factor actually contributed. */
  impact: number;
};

export type AnalysisRecommendation = {
  title: string;
  detail: string;
};

export type RiskLevel = "minimal" | "mild" | "moderate" | "high";

export type DryEyeAnalysis = {
  generatedAt: number;
  modelVersion: string;
  state: "ok" | "insufficient_data";
  riskScore: number | null;
  level: RiskLevel | null;
  levelLabel: string;
  summary: string;
  confidence: { score: number; label: "none" | "low" | "moderate" | "high" };
  window: { days: number; from: number; to: number; extended: boolean };
  coverage: {
    sessionsAnalyzed: number;
    sessionsExcluded: number;
    monitoredMinutes: number;
    totalBlinks: number;
    samplesAnalyzed: number;
  };
  metrics: {
    avgBlinksPerMin?: number | null;
    pctTimeBelow7?: number | null;
    longestBlinkFreeSec?: number | null;
    trendPct?: number | null;
    selfReportedSymptoms?: number | null;
  };
  /** True when the user's onboarding answers were part of this score. */
  usesProfile?: boolean;
  findings: AnalysisFinding[];
  recommendations: AnalysisRecommendation[];
  disclaimer: string;
};

export function riskLevelClass(level: RiskLevel | null): string {
  switch (level) {
    case "minimal":
      return "good";
    case "mild":
      return "medium";
    case "moderate":
      return "warn";
    case "high":
      return "bad";
    default:
      return "";
  }
}

export function statusFromBpm(bpm: number): EyeStatus {
  if (bpm >= 15) return "healthy";
  if (bpm >= 10) return "medium";
  if (bpm >= 7) return "slightly_dry";
  return "dry";
}

export function statusLabel(s: EyeStatus): string {
  switch (s) {
    case "healthy":
      return "Healthy";
    case "medium":
      return "Medium";
    case "slightly_dry":
      return "Slightly dry";
    case "dry":
      return "Dry";
  }
}

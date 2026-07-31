/** Types for the onboarding questionnaire so TypeScript targets can import onboarding.js. */

export declare const SCALE_MIN: number;
export declare const SCALE_MAX: number;

export type ScaleQuestion = { id: string; text: string; low: string; high: string; weight: number };
export type PrimaryReason = { id: string; label: string; detail: string };

export declare const SCALE_QUESTIONS: ScaleQuestion[];
export declare const PRIMARY_REASONS: PrimaryReason[];

export declare function onboardingSchema(): {
  scaleMin: number;
  scaleMax: number;
  questions: { id: string; text: string; low: string; high: string }[];
  reasons: PrimaryReason[];
};

export declare function validateOnboarding(
  body: unknown
): { error: string; value?: undefined } | { value: Record<string, unknown>; error?: undefined };

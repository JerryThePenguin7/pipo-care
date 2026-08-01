/** Types for the dry-eye analysis engine so TypeScript targets can import analysis.js. */

export declare const ANALYSIS_MODEL_VERSION: string;

export declare const DEFAULT_OPTIONS: {
  windowDays: number;
  fallbackSessionCount: number;
};

export declare const FACTOR_WEIGHTS: Record<string, number>;

export type AnalyzeOptions = {
  windowDays?: number;
  fallbackSessionCount?: number;
  /** Fixed clock, for tests. */
  now?: number;
  /** User record; its `onboarding` answers become one scoring factor. */
  profile?: unknown;
};

export declare function analyzeSessions(sessions: unknown[], options?: AnalyzeOptions): unknown;

export declare function selectSessions(
  sessions: unknown[],
  options?: AnalyzeOptions
): { used: unknown[]; excluded: number; extended: boolean; from: number; to: number };

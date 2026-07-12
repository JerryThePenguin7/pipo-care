export type EyeStatus = "healthy" | "medium" | "slightly_dry" | "dry";

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

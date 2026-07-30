import type {
  AuthConfig,
  DryEyeAnalysis,
  Onboarding,
  OnboardingSchema,
  SessionRecord,
  ThemeChoice,
  User,
} from "./types";

/** Thrown on any non-2xx response; `status` lets callers treat 401 as "sign in again". */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    credentials: "same-origin", // session cookie
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(r.status, body.error || `Request failed (${r.status})`);
  }
  return r.status === 204 ? (undefined as T) : ((await r.json()) as T);
}

/* -------------------------------------------------------------- sessions */

export function fetchSessions(): Promise<SessionRecord[]> {
  return request<SessionRecord[]>("/api/sessions");
}

export function fetchSession(id: string): Promise<SessionRecord> {
  return request<SessionRecord>(`/api/sessions/${id}`);
}

export function saveSession(body: Omit<SessionRecord, "id" | "createdAt" | "userId">): Promise<SessionRecord> {
  return request<SessionRecord>("/api/sessions", { method: "POST", body: JSON.stringify(body) });
}

/** Dry-eye risk read-out computed server-side from stored statistics + your profile. */
export function fetchAnalysis(days?: number): Promise<DryEyeAnalysis> {
  return request<DryEyeAnalysis>(`/api/analysis${days ? `?days=${days}` : ""}`);
}

/* ------------------------------------------------------------------ auth */

export function fetchAuthConfig(): Promise<AuthConfig> {
  return request<AuthConfig>("/api/auth/config");
}

export function fetchMe(): Promise<{ user: User }> {
  return request<{ user: User }>("/api/auth/me");
}

export function signInWithGoogle(credential: string): Promise<{ user: User }> {
  return request<{ user: User }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

/** Local-only account, available when the server runs with PIPO_ALLOW_DEV_LOGIN=1. */
export function signInAsDevUser(): Promise<{ user: User }> {
  return request<{ user: User }>("/api/auth/dev-login", { method: "POST", body: "{}" });
}

export function signOut(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: "{}" });
}

/* --------------------------------------------------------------- profile */

export function fetchOnboardingSchema(): Promise<OnboardingSchema> {
  return request<OnboardingSchema>("/api/onboarding/schema");
}

export function updateProfile(patch: {
  displayName?: string;
  avatar?: string;
  theme?: ThemeChoice;
}): Promise<{ user: User }> {
  return request<{ user: User }>("/api/me", { method: "PATCH", body: JSON.stringify(patch) });
}

export function submitOnboarding(body: {
  primaryReason: string;
  scales: Record<string, number>;
}): Promise<{ user: User; onboarding?: Onboarding }> {
  return request<{ user: User }>("/api/me/onboarding", { method: "POST", body: JSON.stringify(body) });
}

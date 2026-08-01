/**
 * The extension's data layer — the `@data` module for the extension build.
 *
 * Everything the web app asks a server for happens here instead: sessions live in
 * chrome.storage.local, and the dry-eye analysis runs in the page using the very same
 * engine the server uses (shared/analysis.js). No account, no network, nothing leaves
 * the machine.
 */
import { analyzeSessions } from "../../../../shared/analysis.js";
import type { DryEyeAnalysis, Onboarding, SessionRecord, ThemeChoice } from "../../../src/types";
import { readKey, writeKey } from "./store";

const SESSIONS_KEY = "sessions";
const PROFILE_KEY = "profile";

/** Local stand-in for the web app's account record. Same shape where it matters. */
export type LocalProfile = {
  displayName: string;
  avatar: string;
  theme: ThemeChoice;
  onboarding: Onboarding;
  createdAt: number;
};

export const EMPTY_PROFILE: LocalProfile = {
  displayName: "",
  avatar: "",
  theme: "light",
  onboarding: { completed: false },
  createdAt: 0,
};

/* -------------------------------------------------------------- sessions */

export async function fetchSessions(): Promise<SessionRecord[]> {
  const all = await readKey<SessionRecord[]>(SESSIONS_KEY, []);
  return [...all].sort((a, b) => b.startedAt - a.startedAt);
}

export async function fetchSession(id: string): Promise<SessionRecord> {
  const all = await readKey<SessionRecord[]>(SESSIONS_KEY, []);
  const found = all.find((s) => s.id === id);
  if (!found) throw new Error("Not found");
  return found;
}

export async function saveSession(
  body: Omit<SessionRecord, "id" | "createdAt" | "userId">
): Promise<SessionRecord> {
  const all = await readKey<SessionRecord[]>(SESSIONS_KEY, []);
  const record: SessionRecord = {
    ...body,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  all.push(record);
  await writeKey(SESSIONS_KEY, all);
  return record;
}

export async function deleteSession(id: string): Promise<void> {
  const all = await readKey<SessionRecord[]>(SESSIONS_KEY, []);
  await writeKey(
    SESSIONS_KEY,
    all.filter((s) => s.id !== id)
  );
}

export async function clearSessions(): Promise<void> {
  await writeKey(SESSIONS_KEY, []);
}

/* -------------------------------------------------------------- analysis */

export async function fetchAnalysis(days?: number): Promise<DryEyeAnalysis> {
  const [sessions, profile] = await Promise.all([fetchSessions(), fetchProfile()]);
  const options: { profile: LocalProfile; windowDays?: number } = { profile };
  if (days) options.windowDays = days;
  return analyzeSessions(sessions, options) as DryEyeAnalysis;
}

/* --------------------------------------------------------------- profile */

export async function fetchProfile(): Promise<LocalProfile> {
  return readKey<LocalProfile>(PROFILE_KEY, EMPTY_PROFILE);
}

export async function saveProfile(patch: Partial<LocalProfile>): Promise<LocalProfile> {
  const current = await fetchProfile();
  const next: LocalProfile = {
    ...current,
    ...patch,
    createdAt: current.createdAt || Date.now(),
  };
  await writeKey(PROFILE_KEY, next);
  return next;
}

export async function resetProfile(): Promise<void> {
  await writeKey(PROFILE_KEY, EMPTY_PROFILE);
}

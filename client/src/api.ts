import type { SessionRecord } from "./types";

export async function fetchSessions(): Promise<SessionRecord[]> {
  const r = await fetch("/api/sessions");
  if (!r.ok) throw new Error("Failed to load sessions");
  return r.json();
}

export async function fetchSession(id: string): Promise<SessionRecord> {
  const r = await fetch(`/api/sessions/${id}`);
  if (!r.ok) throw new Error("Not found");
  return r.json();
}

export async function saveSession(body: Omit<SessionRecord, "id" | "createdAt">): Promise<SessionRecord> {
  const r = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || "Save failed");
  }
  return r.json();
}

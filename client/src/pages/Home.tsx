import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSessions } from "../api";
import { Mascot } from "../components/Mascot";
import type { EyeStatus, SessionRecord } from "../types";
import { statusLabel } from "../types";

const GREETINGS = [
  "Have your eyes been great today?",
  "Is your vision feeling comfortable right now?",
  "Let's keep your eyes hydrated!",
  "Ready for a gentle blink check-in?",
  "Small breaks today — happier eyes tomorrow.",
  "Your blink rate matters — let's watch it together.",
];

function worseStatus(a: EyeStatus, b: EyeStatus): EyeStatus {
  const rank: Record<EyeStatus, number> = { healthy: 0, medium: 1, slightly_dry: 2, dry: 3 };
  return rank[a] >= rank[b] ? a : b;
}

function badgeClass(s: EyeStatus) {
  if (s === "healthy") return "good";
  if (s === "medium") return "medium";
  if (s === "slightly_dry") return "warn";
  return "bad";
}

export function Home() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  const dayRows = useMemo(() => {
    const byDay = new Map<string, { date: Date; status: EyeStatus; count: number; avgSum: number }>();
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, { date: new Date(d), status: "healthy", count: 0, avgSum: 0 });
    }

    for (const s of sessions) {
      const day = new Date(s.startedAt).toISOString().slice(0, 10);
      if (!byDay.has(day)) continue;
      const row = byDay.get(day)!;
      row.count += 1;
      row.avgSum += s.avgBlinksPerMin;
      row.status = worseStatus(row.status, s.status);
    }

    return [...byDay.values()]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((row) => ({
        label: row.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        status: row.count ? row.status : null,
        hint: row.count ? `${row.count} session(s)` : "No sessions",
        avg: row.count ? Math.round((row.avgSum / row.count) * 10) / 10 : null,
      }));
  }, [sessions]);

  return (
    <div className="page">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <h1 className="h1">Pipo Care</h1>
          <p className="sub" style={{ margin: 0 }}>
            Eye comfort companion
          </p>
        </div>
        <span style={{ fontSize: 22, opacity: 0.85 }} aria-hidden>
          ⏱️
        </span>
      </header>

      <section className="card" style={{ padding: 20, marginBottom: 18, textAlign: "center" }}>
        <p style={{ fontWeight: 600, margin: "0 0 8px", fontSize: "1.05rem" }}>{greeting}</p>
        <Mascot />
        <Link to="/monitor" className="btn-primary" style={{ textDecoration: "none" }}>
          <span aria-hidden>▶</span> Start monitoring
        </Link>
      </section>

      <section>
        <h2 className="h1" style={{ fontSize: "1.05rem", marginBottom: 10 }}>
          Recent eye comfort (7 days)
        </h2>
        <div className="card" style={{ padding: 4 }}>
          {dayRows.map((row) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{row.label}</div>
                <div className="sub" style={{ margin: 0, fontSize: "0.8rem" }}>
                  {row.hint}
                  {row.avg != null ? ` · avg ${row.avg}/min` : ""}
                </div>
              </div>
              {row.status ? (
                <span className={"badge " + badgeClass(row.status)}>{statusLabel(row.status)}</span>
              ) : (
                <span className="badge" style={{ color: "var(--muted)", background: "transparent" }}>
                  —
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

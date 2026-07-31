import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSessions } from "@data";
import type { EyeStatus, SessionRecord } from "../types";
import { statusLabel } from "../types";

type Filter = "all" | "optimal" | "dryish";

function badgeClass(s: EyeStatus) {
  if (s === "healthy") return "good";
  if (s === "medium") return "medium";
  if (s === "slightly_dry") return "warn";
  return "bad";
}

function isOptimal(s: EyeStatus) {
  return s === "healthy" || s === "medium";
}

function isDryish(s: EyeStatus) {
  return s === "slightly_dry" || s === "dry";
}

export function History() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "optimal") return sessions.filter((s) => isOptimal(s.status));
    if (filter === "dryish") return sessions.filter((s) => isDryish(s.status));
    return sessions;
  }, [sessions, filter]);

  const groups = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const thisWeek: SessionRecord[] = [];
    const older: SessionRecord[] = [];

    for (const s of filtered) {
      const d = new Date(s.startedAt);
      if (d >= startOfWeek) thisWeek.push(s);
      else older.push(s);
    }

    return [
      { title: "This week", items: thisWeek },
      { title: "Earlier", items: older },
    ].filter((g) => g.items.length);
  }, [filtered]);

  return (
    <div className="page">
      <header style={{ marginBottom: 12 }}>
        <h1 className="h1">Capture history</h1>
        <p className="sub" style={{ margin: 0 }}>
          Review recent ocular assessments and open any session for full detail.
        </p>
      </header>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {(
          [
            ["all", "All captures"],
            ["optimal", "Optimal"],
            ["dryish", "Slightly dry / dry"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" className={"chip" + (filter === key ? " active" : "")} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="sub">No sessions match this filter yet.</p>}

      {groups.map((g) => (
        <section key={g.title} style={{ marginBottom: 18 }}>
          <h2 className="h1" style={{ fontSize: "0.85rem", letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 8px" }}>
            {g.title.toUpperCase()}
          </h2>
          <div className="card-grid">
            {g.items.map((s) => {
              const dt = new Date(s.startedAt);
              const good = isOptimal(s.status);
              return (
                <Link
                  key={s.id}
                  to={`/history/${s.id}`}
                  className="card"
                  style={{
                    padding: 14,
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: "rgba(46,91,255,0.1)",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 18,
                        }}
                        aria-hidden
                      >
                        👁️
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {dt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </div>
                        <div className="sub" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                          {Math.round(s.durationMs / 1000)}s · {s.blinkCount} blinks · avg {s.avgBlinksPerMin}/min
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className={"badge " + badgeClass(s.status)}>{statusLabel(s.status)}</span>
                      <div style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--primary)", fontWeight: 600 }}>
                        Details →
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: "0.8rem", color: "var(--muted)" }}>
                    Quick signal:{" "}
                    <strong style={{ color: good ? "var(--good)" : "var(--warn)" }}>{good ? "Good" : "Needs care"}</strong>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

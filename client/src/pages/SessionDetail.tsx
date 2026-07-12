import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchSession } from "../api";
import type { SessionRecord } from "../types";
import { statusLabel } from "../types";

function badgeClass(s: SessionRecord["status"]) {
  if (s === "healthy") return "good";
  if (s === "medium") return "medium";
  if (s === "slightly_dry") return "warn";
  return "bad";
}

export function SessionDetail() {
  const { id } = useParams();
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchSession(id)
      .then(setSession)
      .catch(() => setError("Session not found"));
  }, [id]);

  if (error || !session) {
    return (
      <div className="page">
        <p className="sub">{error || "Loading…"}</p>
        <Link to="/history">← Back to history</Link>
      </div>
    );
  }

  const start = new Date(session.startedAt);
  const end = new Date(session.endedAt);
  const chartData = session.samples.map((p) => ({
    t: p.t,
    bpm: p.bpm,
    cum: p.cumBlinks,
    ear: p.avgEar,
    status: statusLabel(p.status),
  }));

  return (
    <div className="page">
      <Link to="/history" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
        ← History
      </Link>

      <header style={{ margin: "14px 0 12px" }}>
        <h1 className="h1">Session detail</h1>
        <p className="sub" style={{ margin: 0 }}>
          Full capture metadata and per-sample timeline.
        </p>
      </header>

      <section className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{start.toLocaleString()}</div>
            <div className="sub" style={{ margin: "6px 0 0" }}>
              Ended {end.toLocaleTimeString()} · duration {(session.durationMs / 1000).toFixed(1)}s
            </div>
          </div>
          <span className={"badge " + badgeClass(session.status)}>{statusLabel(session.status)}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          {[
            ["Session ID", session.id],
            ["Total blinks", String(session.blinkCount)],
            ["Avg blinks / min", String(session.avgBlinksPerMin)],
            ["Min rolling / min", session.minBpm != null ? String(session.minBpm) : "—"],
            ["Max rolling / min", session.maxBpm != null ? String(session.maxBpm) : "—"],
            ["Dryness alerts", String(session.alertsTriggered ?? 0)],
            ["Samples recorded", String(session.samples.length)],
            ["Server stored at", session.createdAt ? new Date(session.createdAt).toLocaleString() : "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="card" style={{ padding: 10, boxShadow: "none" }}>
              <div className="sub" style={{ margin: "0 0 4px", fontSize: "0.75rem" }}>
                {k}
              </div>
              <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 12, marginBottom: 12 }}>
        <h2 className="h1" style={{ fontSize: "1rem", margin: "0 0 8px" }}>
          Blink rate over time
        </h2>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bpm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2e5bff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2e5bff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="t" tick={{ fill: "var(--muted)", fontSize: 11 }} label={{ value: "s", position: "insideBottomRight", offset: -4, fill: "var(--muted)" }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }}
                formatter={(value: number, name: string) => [value, name === "bpm" ? "Blinks/min (rolling)" : name]}
              />
              <Area type="monotone" dataKey="bpm" stroke="#2e5bff" fill="url(#bpm)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2 className="h1" style={{ fontSize: "1rem", margin: 0 }}>
            Sample-by-sample log
          </h2>
          <p className="sub" style={{ margin: "6px 0 0", fontSize: "0.8rem" }}>
            Each row is a snapshot taken every ~5 seconds during capture.
          </p>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "10px 12px" }}>t (s)</th>
                <th style={{ padding: "10px 12px" }}>Rolling bpm</th>
                <th style={{ padding: "10px 12px" }}>Cumulative blinks</th>
                <th style={{ padding: "10px 12px" }}>EAR</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {session.samples.map((p, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px" }}>{p.t}</td>
                  <td style={{ padding: "10px 12px" }}>{p.bpm}</td>
                  <td style={{ padding: "10px 12px" }}>{p.cumBlinks}</td>
                  <td style={{ padding: "10px 12px" }}>{p.avgEar ?? "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className={"badge " + badgeClass(p.status)}>{statusLabel(p.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchSessions } from "../api";
import type { SessionRecord } from "../types";

export function Insights() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, []);

  const perSession = useMemo(() => {
    return [...sessions]
      .sort((a, b) => a.startedAt - b.startedAt)
      .map((s) => ({
        name: new Date(s.startedAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        avg: s.avgBlinksPerMin,
      }));
  }, [sessions]);

  const combinedTimeline = useMemo(() => {
    const points: { idx: number; bpm: number; session: string }[] = [];
    let i = 0;
    for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
      const startLabel = new Date(s.startedAt).toLocaleString(undefined, { month: "short", day: "numeric" });
      for (const p of s.samples) {
        points.push({ idx: i++, bpm: p.bpm, session: startLabel });
      }
    }
    return points.slice(-500);
  }, [sessions]);

  const distribution = useMemo(() => {
    const buckets = [
      { range: "0-6 (risk)", count: 0 },
      { range: "7-9", count: 0 },
      { range: "10-14", count: 0 },
      { range: "15+", count: 0 },
    ];
    for (const s of sessions) {
      const v = s.avgBlinksPerMin;
      if (v < 7) buckets[0].count += 1;
      else if (v < 10) buckets[1].count += 1;
      else if (v < 15) buckets[2].count += 1;
      else buckets[3].count += 1;
    }
    return buckets;
  }, [sessions]);

  return (
    <div className="page">
      <header style={{ marginBottom: 12 }}>
        <h1 className="h1">Insights</h1>
        <p className="sub" style={{ margin: 0 }}>
          Session averages, combined intra-session trends, and how often you land in risky blink zones.
        </p>
      </header>

      <section className="card" style={{ padding: 12, marginBottom: 14 }}>
        <h2 className="h1" style={{ fontSize: "1rem", margin: "0 0 8px" }}>
          Average blink rate per session
        </h2>
        <p className="sub" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
          Line chart highlights improvement or fatigue patterns across days.
        </p>
        <div className="chart-box tall">
          <ResponsiveContainer>
            <LineChart data={perSession} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} label={{ value: "blinks/min", angle: -90, position: "insideLeft", fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ borderRadius: 12 }} />
              <Legend />
              <Line type="monotone" dataKey="avg" name="Avg blinks / min" stroke="#2e5bff" strokeWidth={3} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card" style={{ padding: 12, marginBottom: 14 }}>
        <h2 className="h1" style={{ fontSize: "1rem", margin: "0 0 8px" }}>
          Combined sample cloud (all sessions)
        </h2>
        <p className="sub" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
          Each point is a 5-second snapshot. Useful to see how often you dip under safe blink cadence while staring at a display.
        </p>
        <div className="chart-box">
          <ResponsiveContainer>
            <LineChart data={combinedTimeline} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="idx" hide />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} domain={[0, "auto"]} />
              <Tooltip
                contentStyle={{ borderRadius: 12 }}
                formatter={(v: number) => [`${v} /min`, "Rolling"]}
                labelFormatter={(_l, payload) => {
                  const row = (payload as ReadonlyArray<{ payload?: { session?: string } }> | undefined)?.[0]?.payload;
                  return row?.session ? `Session day: ${row.session}` : "";
                }}
              />
              <Line type="monotone" dataKey="bpm" stroke="#4a69ff" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card" style={{ padding: 12, marginBottom: 24 }}>
        <h2 className="h1" style={{ fontSize: "1rem", margin: "0 0 8px" }}>
          Session distribution by comfort zone
        </h2>
        <div className="chart-box">
          <ResponsiveContainer>
            <BarChart data={distribution} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="range" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12 }} />
              <Bar dataKey="count" name="Sessions" fill="#2e5bff" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

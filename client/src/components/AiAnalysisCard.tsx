import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAnalysis } from "@data";
import type { AnalysisFinding, DryEyeAnalysis, RiskLevel } from "../types";

/**
 * Home-page read-out of the dry-eye analysis engine (shared/analysis.js).
 * This component only renders the verdict, the evidence behind it and what to do — the
 * scoring runs on the server in the web app and in the page in the Chrome extension.
 */

const LEVEL_COLOR: Record<RiskLevel, string> = {
  minimal: "var(--good)",
  mild: "var(--medium)",
  moderate: "var(--warn)",
  high: "var(--bad)",
};

const SEVERITY_COLOR: Record<AnalysisFinding["severity"], string> = {
  good: "var(--good)",
  watch: "var(--warn)",
  risk: "var(--bad)",
};

const SEVERITY_LABEL: Record<AnalysisFinding["severity"], string> = {
  good: "Normal",
  watch: "Watch",
  risk: "Risk",
};

const VISIBLE_FINDINGS = 3;

function RiskDial({ score, level }: { score: number; level: RiskLevel }) {
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const color = LEVEL_COLOR[level];

  return (
    <svg width="118" height="118" viewBox="0 0 120 120" role="img" aria-label={`Dry-eye risk score ${score} out of 100`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="11" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dasharray 700ms ease" }}
      />
      <text x="60" y="57" textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--text)">
        {score}
      </text>
      <text x="60" y="76" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--muted)">
        / 100 risk
      </text>
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: "10px 12px", boxShadow: "none" }}>
      <div className="sub" style={{ margin: "0 0 4px", fontSize: "0.7rem" }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{value}</div>
    </div>
  );
}

function Finding({ finding }: { finding: AnalysisFinding }) {
  const color = SEVERITY_COLOR[finding.severity];
  return (
    <li style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color,
          marginTop: 6,
          flexShrink: 0,
        }}
        aria-hidden
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "0.9rem" }}>{finding.label}</strong>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color }}>{SEVERITY_LABEL[finding.severity]}</span>
          <span className="sub" style={{ margin: 0, fontSize: "0.75rem" }}>
            +{finding.impact} pts
          </span>
        </div>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, margin: "2px 0 2px" }}>{finding.value}</div>
        <p className="sub" style={{ margin: 0, fontSize: "0.8rem" }}>
          {finding.detail}
        </p>
      </div>
    </li>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 16 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            display: "grid",
            placeItems: "center",
            background: "rgba(46, 91, 255, 0.12)",
            fontSize: 15,
          }}
          aria-hidden
        >
          ✨
        </span>
        <h2 className="h1" style={{ fontSize: "1.05rem", margin: 0 }}>
          AI dry-eye analysis
        </h2>
      </header>
      {children}
    </section>
  );
}

export function AiAnalysisCard() {
  const [analysis, setAnalysis] = useState<DryEyeAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAnalysis()
      .then(setAnalysis)
      .catch(() => setError("Could not run the dry-eye analysis just now."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) {
    return (
      <Shell>
        <p className="sub" style={{ margin: "6px 0 12px", fontSize: "0.85rem" }}>
          Reviewing your monitoring statistics…
        </p>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div className="skeleton" style={{ width: 96, height: 96, borderRadius: "50%" }} />
          <div style={{ flex: 1, display: "grid", gap: 8 }}>
            <div className="skeleton" style={{ height: 14, width: "70%" }} />
            <div className="skeleton" style={{ height: 12, width: "90%" }} />
            <div className="skeleton" style={{ height: 12, width: "55%" }} />
          </div>
        </div>
      </Shell>
    );
  }

  if (error || !analysis) {
    return (
      <Shell>
        <p className="sub" style={{ margin: "6px 0 12px", fontSize: "0.85rem" }}>
          {error}
        </p>
        <button type="button" className="btn-ghost" onClick={load}>
          Try again
        </button>
      </Shell>
    );
  }

  if (analysis.state === "insufficient_data") {
    return (
      <Shell>
        <p className="sub" style={{ margin: "6px 0 14px", fontSize: "0.85rem" }}>
          {analysis.summary}
        </p>
        {analysis.coverage.sessionsExcluded > 0 && (
          <p className="sub" style={{ margin: "0 0 14px", fontSize: "0.78rem" }}>
            {analysis.coverage.sessionsExcluded === 1
              ? "1 very short capture was skipped — it is too brief to say anything reliable."
              : `${analysis.coverage.sessionsExcluded} very short captures were skipped — they are too brief to say anything reliable.`}
          </p>
        )}
        <Link to="/monitor" className="btn-primary" style={{ textDecoration: "none" }}>
          <span aria-hidden>▶</span> Run a capture
        </Link>
      </Shell>
    );
  }

  const level = (analysis.level ?? "minimal") as RiskLevel;
  const score = analysis.riskScore ?? 0;
  const color = LEVEL_COLOR[level];
  const findings = expanded ? analysis.findings : analysis.findings.slice(0, VISIBLE_FINDINGS);
  const m = analysis.metrics;
  const windowLabel = `${analysis.window.days} ${analysis.window.days === 1 ? "day" : "days"}`;

  return (
    <Shell>
      <p className="sub" style={{ margin: "6px 0 14px", fontSize: "0.85rem" }}>
        {analysis.window.extended
          ? `No captures in the last ${windowLabel} — analysing your most recent ones instead.`
          : `Automated review of your last ${windowLabel} of monitoring.`}
      </p>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
        <RiskDial score={score} level={level} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: "1.05rem", color }}>{analysis.levelLabel}</div>
          <p className="sub" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
            {analysis.summary}
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        <Stat label="Avg blink rate" value={m.avgBlinksPerMin != null ? `${m.avgBlinksPerMin}/min` : "—"} />
        <Stat
          label="Longest without blinking"
          value={m.longestBlinkFreeSec != null ? `${m.longestBlinkFreeSec}s` : "—"}
        />
        <Stat label="Time under 7/min" value={m.pctTimeBelow7 != null ? `${m.pctTimeBelow7}%` : "—"} />
        <Stat
          label="Analysed"
          value={`${analysis.coverage.sessionsAnalyzed} ${
            analysis.coverage.sessionsAnalyzed === 1 ? "session" : "sessions"
          } · ${analysis.coverage.monitoredMinutes} min`}
        />
      </div>

      <h3 style={{ fontSize: "0.8rem", letterSpacing: "0.06em", color: "var(--muted)", margin: "0 0 2px" }}>
        WHAT DROVE THIS SCORE
      </h3>
      <ul style={{ listStyle: "none", margin: "0 0 8px", padding: 0 }}>
        {findings.map((f) => (
          <Finding key={f.key} finding={f} />
        ))}
      </ul>
      {analysis.findings.length > VISIBLE_FINDINGS && (
        <button
          type="button"
          className="btn-ghost"
          style={{ width: "100%", marginBottom: 14 }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show fewer signals" : `Show all ${analysis.findings.length} signals`}
        </button>
      )}

      <h3 style={{ fontSize: "0.8rem", letterSpacing: "0.06em", color: "var(--muted)", margin: "14px 0 8px" }}>
        WHAT TO DO
      </h3>
      <ul className="card-grid" style={{ listStyle: "none", margin: 0, padding: 0, gap: 8 }}>
        {analysis.recommendations.map((r) => (
          <li
            key={r.title}
            className="card"
            style={{ padding: "10px 12px", boxShadow: "none", background: "rgba(46, 91, 255, 0.06)" }}
          >
            <strong style={{ fontSize: "0.88rem" }}>{r.title}</strong>
            <p className="sub" style={{ margin: "3px 0 0", fontSize: "0.8rem" }}>
              {r.detail}
            </p>
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 14 }}>
        <span className="sub" style={{ margin: 0, fontSize: "0.75rem" }}>
          Confidence: <strong style={{ color: "var(--text)" }}>{analysis.confidence.label}</strong>
          {analysis.coverage.sessionsExcluded > 0 ? ` · ${analysis.coverage.sessionsExcluded} short capture${analysis.coverage.sessionsExcluded === 1 ? "" : "s"} skipped` : ""}
        </span>
        <Link to="/insights" style={{ fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap" }}>
          Charts →
        </Link>
      </div>
      {analysis.usesProfile && (
        <p className="sub" style={{ margin: "8px 0 0", fontSize: "0.75rem" }}>
          Includes the setup answers from your profile
          {m.selfReportedSymptoms != null ? ` (${m.selfReportedSymptoms}/5 reported discomfort)` : ""} ·{" "}
          <Link to="/welcome?redo=1">update them</Link>
        </p>
      )}
      <p className="sub" style={{ margin: "8px 0 0", fontSize: "0.72rem" }}>
        {analysis.disclaimer} · Model {analysis.modelVersion}
      </p>
    </Shell>
  );
}

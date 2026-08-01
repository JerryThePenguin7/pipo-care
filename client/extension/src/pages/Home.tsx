import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AiAnalysisCard } from "../../../src/components/AiAnalysisCard";
import { Avatar } from "../../../src/components/Avatar";
import { fetchSessions } from "../data/localData";
import { useProfile } from "../profile";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

/** Rough "have you monitored today" line — cheap context before the analysis card. */
function useTodaySummary() {
  const [summary, setSummary] = useState<{ count: number; minutes: number } | null>(null);
  useEffect(() => {
    fetchSessions()
      .then((all) => {
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        const today = all.filter((s) => s.startedAt >= midnight.getTime());
        setSummary({
          count: today.length,
          minutes: Math.round(today.reduce((acc, s) => acc + s.durationMs, 0) / 60000),
        });
      })
      .catch(() => setSummary({ count: 0, minutes: 0 }));
  }, []);
  return summary;
}

export function Home() {
  const { profile } = useProfile();
  const today = useTodaySummary();

  return (
    <div className="page">
      <header className="ext-greeting">
        <div style={{ minWidth: 0 }}>
          <h1 className="h1">Hi {firstName(profile.displayName)}</h1>
          <p className="sub" style={{ margin: 0 }}>
            {today === null
              ? "Checking today’s captures…"
              : today.count === 0
                ? "No captures yet today."
                : `${today.count} capture${today.count === 1 ? "" : "s"} today · ${today.minutes} min monitored`}
          </p>
        </div>
        <Link to="/settings" aria-label="Your profile and settings">
          <Avatar src={profile.avatar} name={profile.displayName || "?"} size={38} ring />
        </Link>
      </header>

      <Link to="/monitor" className="btn-primary" style={{ textDecoration: "none", marginBottom: 16 }}>
        <span aria-hidden>▶</span> Start monitoring
      </Link>

      <AiAnalysisCard />
    </div>
  );
}

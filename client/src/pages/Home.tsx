import { useState } from "react";
import { Link } from "react-router-dom";
import { AiAnalysisCard } from "../components/AiAnalysisCard";
import { Avatar } from "../components/Avatar";
import { Mascot } from "../components/Mascot";
import { useAuth } from "../context/AuthContext";

const GREETINGS = [
  "Have your eyes been great today?",
  "Is your vision feeling comfortable right now?",
  "Let's keep your eyes hydrated!",
  "Ready for a gentle blink check-in?",
  "Small breaks today — happier eyes tomorrow.",
  "Your blink rate matters — let's watch it together.",
];

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

export function Home() {
  const { user } = useAuth();
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  return (
    <div className="page">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="h1">Hi {user ? firstName(user.displayName) : "there"}</h1>
          <p className="sub" style={{ margin: 0 }}>
            Eye comfort companion
          </p>
        </div>
        {/* Doubles as the account entry point on phones, where there is no sidebar. */}
        <Link to="/settings" aria-label="Your profile and settings">
          <Avatar src={user?.avatar} name={user?.displayName || "?"} size={40} ring />
        </Link>
      </header>

      <div className="split">
        <section className="card" style={{ padding: 20, textAlign: "center" }}>
          <p style={{ fontWeight: 600, margin: "0 0 8px", fontSize: "1.05rem" }}>{greeting}</p>
          <Mascot />
          <Link to="/monitor" className="btn-primary" style={{ textDecoration: "none" }}>
            <span aria-hidden>▶</span> Start monitoring
          </Link>
        </section>

        <AiAnalysisCard />
      </div>
    </div>
  );
}

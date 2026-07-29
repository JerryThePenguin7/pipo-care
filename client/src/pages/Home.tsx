import { useState } from "react";
import { Link } from "react-router-dom";
import { AiAnalysisCard } from "../components/AiAnalysisCard";
import { Mascot } from "../components/Mascot";

const GREETINGS = [
  "Have your eyes been great today?",
  "Is your vision feeling comfortable right now?",
  "Let's keep your eyes hydrated!",
  "Ready for a gentle blink check-in?",
  "Small breaks today — happier eyes tomorrow.",
  "Your blink rate matters — let's watch it together.",
];

export function Home() {
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

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

      <AiAnalysisCard />
    </div>
  );
}

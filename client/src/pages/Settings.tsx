import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "../context/ThemeContext";

const NOTIF_KEY = "pipo-care-notifications";

export function Settings() {
  const { dark, setDark } = useTheme();
  const [notif, setNotif] = useState(false);
  const [notifHint, setNotifHint] = useState<string | null>(null);

  useEffect(() => {
    try {
      setNotif(localStorage.getItem(NOTIF_KEY) === "1");
    } catch {
      setNotif(false);
    }
  }, []);

  const toggleNotif = async () => {
    const next = !notif;
    if (next && "Notification" in window) {
      const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (perm !== "granted") {
        setNotifHint("Permission denied — dryness alerts will stay in the app only.");
        setNotif(false);
        try {
          localStorage.setItem(NOTIF_KEY, "0");
        } catch {
          /* ignore */
        }
        return;
      }
    }
    setNotif(next);
    setNotifHint(null);
    try {
      localStorage.setItem(NOTIF_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="page">
      <header style={{ marginBottom: 12 }}>
        <h1 className="h1">Settings</h1>
        <p className="sub" style={{ margin: 0 }}>
          Personalize Pipo Care for daily screen work.
        </p>
      </header>

      <section className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary), var(--primary-soft))",
              color: "white",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: "1.2rem",
            }}
            aria-hidden
          >
            PC
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Pipo Care user</div>
            <div className="sub" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
              Local-only profile · sessions stored on this device’s server folder
            </div>
          </div>
        </div>
        <button type="button" className="btn-ghost" style={{ marginTop: 12, width: "100%" }} disabled>
          Edit profile (coming soon)
        </button>
      </section>

      <section className="card" style={{ padding: 8, marginBottom: 14 }}>
        <Row
          title="Notifications"
          subtitle="Optional browser alerts when dryness risk is detected."
          control={
            <button
              type="button"
              role="switch"
              aria-checked={notif}
              onClick={toggleNotif}
              style={{
                width: 52,
                height: 30,
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: notif ? "var(--primary)" : "var(--bg)",
                position: "relative",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: notif ? 26 : 4,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "white",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                  transition: "left 0.15s ease",
                }}
              />
            </button>
          }
        />
        {notifHint && (
          <p style={{ color: "var(--warn)", fontSize: "0.85rem", margin: "0 12px 8px" }} role="status">
            {notifHint}
          </p>
        )}
        <Row
          title="Dark mode"
          subtitle="Reduce glare for evening screen sessions."
          control={
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              onClick={() => setDark(!dark)}
              style={{
                width: 52,
                height: 30,
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: dark ? "var(--primary)" : "var(--bg)",
                position: "relative",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: dark ? 26 : 4,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "white",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                  transition: "left 0.15s ease",
                }}
              />
            </button>
          }
        />
      </section>

      <section className="card" style={{ padding: 8, marginBottom: 14 }}>
        <LinkRow title="Privacy policy" subtitle="How Pipo Care handles your camera feed." />
        <LinkRow title="Data permissions" subtitle="Camera access is used only for on-device blink analytics." />
      </section>

      <section className="card" style={{ padding: 8, marginBottom: 14 }}>
        <LinkRow title="Help & support" subtitle="Tips for dry-eye comfort while using displays." />
        <LinkRow title="About Pipo Care" subtitle="Version 1.0 · educational wellness companion, not a medical device." />
      </section>

      <button
        type="button"
        className="btn-ghost"
        style={{ width: "100%", borderColor: "var(--bad)", color: "var(--bad)", fontWeight: 700 }}
        onClick={() => {
          try {
            localStorage.clear();
          } catch {
            /* ignore */
          }
          window.location.reload();
        }}
      >
        Reset local preferences
      </button>
    </div>
  );
}

function Row({
  title,
  subtitle,
  control,
}: {
  title: string;
  subtitle: string;
  control: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12 }}>
      <div>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div className="sub" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
          {subtitle}
        </div>
      </div>
      {control}
    </div>
  );
}

function LinkRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <button
      type="button"
      className="btn-ghost"
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        textAlign: "left",
        border: "none",
        borderRadius: 0,
        borderBottom: "1px solid var(--border)",
        padding: "14px 12px",
      }}
      onClick={() => alert(`${title}\n\n${subtitle}`)}
    >
      <div>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div className="sub" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
          {subtitle}
        </div>
      </div>
      <span style={{ color: "var(--muted)" }}>›</span>
    </button>
  );
}

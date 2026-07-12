import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/monitor", label: "Monitor", icon: CamIcon },
  { to: "/history", label: "History", icon: ClockIcon },
  { to: "/insights", label: "Insights", icon: ChartIcon },
  { to: "/settings", label: "Settings", icon: GearIcon },
];

export function BottomNav() {
  return (
    <nav
      className="bottom-nav"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "10px 8px calc(10px + env(safe-area-inset-bottom))",
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        zIndex: 40,
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
          style={({ isActive }) => ({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            fontWeight: 600,
            color: isActive ? "var(--primary)" : "var(--muted)",
            textDecoration: "none",
            flex: 1,
            minWidth: 0,
          })}
        >
          <Icon />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function CamIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 12l4-4 4 4 6-6" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

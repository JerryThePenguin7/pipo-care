import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { Home } from "./pages/Home";
import { Setup } from "./pages/Setup";
import { ExtensionSettings } from "./pages/Settings";
import { Monitor } from "../../src/pages/Monitor";
import { History } from "../../src/pages/History";
import { SessionDetail } from "../../src/pages/SessionDetail";
import { Insights } from "../../src/pages/Insights";
import { useTheme } from "../../src/context/ThemeContext";
import { useProfile } from "./profile";

/** Setup has to be finished before the rest of the app is usable — it feeds the analysis. */
function RequireSetup({ children }: { children: React.ReactNode }) {
  const { ready, profile } = useProfile();
  if (!ready) {
    return (
      <div className="ext-splash">
        <p className="sub">Loading…</p>
      </div>
    );
  }
  if (!profile.onboarding?.completed) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

function ProfileThemeSync() {
  const { profile } = useProfile();
  const { setDark } = useTheme();
  const theme = profile.theme;
  useEffect(() => {
    if (theme) setDark(theme === "dark");
  }, [theme, setDark]);
  return null;
}

export default function App() {
  return (
    <>
      <ProfileThemeSync />
      <Routes>
        <Route path="/welcome" element={<Setup />} />
        <Route
          path="*"
          element={
            <RequireSetup>
              <Shell>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/monitor" element={<Monitor />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/history/:id" element={<SessionDetail />} />
                  <Route path="/insights" element={<Insights />} />
                  <Route path="/settings" element={<ExtensionSettings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Shell>
            </RequireSetup>
          }
        />
      </Routes>
    </>
  );
}

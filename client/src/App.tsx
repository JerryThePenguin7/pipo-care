import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import { useTheme } from "./context/ThemeContext";
import { Home } from "./pages/Home";
import { Monitor } from "./pages/Monitor";
import { History } from "./pages/History";
import { SessionDetail } from "./pages/SessionDetail";
import { Insights } from "./pages/Insights";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";

function Splash() {
  return (
    <div className="auth-screen">
      <p className="sub">Loading Pipo Care…</p>
    </div>
  );
}

/** Signed in and set up, or bounced to the right step of the funnel. */
function RequireAccount({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  if (status === "loading") return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboarding?.completed) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

/** Keeps the rendered theme in step with the signed-in profile. */
function ProfileThemeSync() {
  const { user } = useAuth();
  const { setDark } = useTheme();
  const theme = user?.theme;
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
        <Route path="/login" element={<Login />} />
        <Route path="/welcome" element={<Onboarding />} />
        <Route
          element={
            <RequireAccount>
              <Layout />
            </RequireAccount>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<SessionDetail />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

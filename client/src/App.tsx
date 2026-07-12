import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Monitor } from "./pages/Monitor";
import { History } from "./pages/History";
import { SessionDetail } from "./pages/SessionDetail";
import { Insights } from "./pages/Insights";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/monitor" element={<Monitor />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:id" element={<SessionDetail />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

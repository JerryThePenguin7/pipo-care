import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";

/**
 * App shell. The sidebar and the bottom bar are both rendered; index.css shows exactly
 * one of them per breakpoint, so navigation never depends on a JS media query.
 */
export function Layout() {
  return (
    <div className="app-shell">
      <SideNav />
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

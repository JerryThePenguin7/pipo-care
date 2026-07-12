import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function Layout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}

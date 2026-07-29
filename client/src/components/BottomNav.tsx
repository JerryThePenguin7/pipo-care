import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./navItems";

/** Mobile navigation. Hidden from tablet width up, where SideNav takes over (index.css). */
export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

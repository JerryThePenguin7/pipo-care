import { NavLink } from "react-router-dom";
import { Avatar } from "./Avatar";
import { NAV_ITEMS } from "./navItems";
import { useAuth } from "../context/AuthContext";
import { disableGoogleAutoSelect } from "../lib/googleIdentity";

/** Desktop navigation. Hidden below the tablet breakpoint, where BottomNav takes over. */
export function SideNav() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    disableGoogleAutoSelect();
    await signOut();
  };

  return (
    <aside className="side-nav" aria-label="Main">
      <div className="side-nav-brand">
        <span className="side-nav-logo" aria-hidden>
          👁️
        </span>
        <div>
          <strong>Pipo Care</strong>
          <span className="sub" style={{ display: "block", margin: 0, fontSize: "0.75rem" }}>
            Eye comfort companion
          </span>
        </div>
      </div>

      <nav className="side-nav-links">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => "side-nav-item" + (isActive ? " active" : "")}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="side-nav-account">
          <NavLink to="/settings" className="side-nav-user">
            <Avatar src={user.avatar} name={user.displayName} size={36} />
            <span className="side-nav-user-text">
              <strong>{user.displayName}</strong>
              <span className="sub">{user.email}</span>
            </span>
          </NavLink>
          <button type="button" className="btn-ghost" style={{ width: "100%" }} onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}

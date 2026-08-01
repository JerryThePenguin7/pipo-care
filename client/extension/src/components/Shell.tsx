import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "../../../src/components/navItems";
import { cameraPermissionState } from "../../../src/lib/cameraContext";
import { isExtension, isTabSurface } from "../data/store";

/**
 * Extension chrome: a compact header plus a horizontal tab strip.
 *
 * Deliberately not the web app's responsive bottom-bar/sidebar pair. This UI has to look
 * right at ~360px in the side panel *and* at full width in a tab, and a strip that simply
 * scrolls does that without a breakpoint deciding which of two navigations exists.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  // In a tab, spell out the one thing a tab is uniquely good for: granting the camera.
  const [needsGrant, setNeedsGrant] = useState(false);
  useEffect(() => {
    if (!isTabSurface()) return;
    let alive = true;
    cameraPermissionState().then((s) => {
      if (alive) setNeedsGrant(s === "prompt" || s === "denied");
    });
    return () => {
      alive = false;
    };
  }, []);

  const openInTab = () => {
    if (isExtension()) void chrome.runtime.sendMessage({ type: "open-tab", route: window.location.hash });
    else window.open(window.location.href, "_blank");
  };

  return (
    <div className="ext-shell">
      <header className="ext-header">
        <span className="ext-mark">
          <span className="ext-mark-accent">Pipo</span> Care
        </span>
        <button type="button" className="ext-tab-btn" onClick={openInTab} title="Open in a full tab">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M14 4h6v6" />
            <path d="M20 4l-8 8" />
            <path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
          </svg>
          <span>Tab</span>
        </button>
      </header>

      <nav className="ext-nav" aria-label="Main">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => "ext-nav-item" + (isActive ? " active" : "")}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {needsGrant && (
        <p className="ext-grant-hint" role="status">
          <strong>One-time setup:</strong> open <strong>Monitor</strong>, press <strong>Start capture</strong> and choose{" "}
          <strong>Allow</strong>. Chrome remembers it for Pipo Care, so the side panel will work afterwards.
        </p>
      )}

      <main className="ext-main">{children}</main>
    </div>
  );
}

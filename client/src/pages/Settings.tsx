import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { fileToAvatarDataUrl } from "../lib/avatar";
import { disableGoogleAutoSelect } from "../lib/googleIdentity";

const NOTIF_KEY = "pipo-care-notifications";

export function Settings() {
  const { dark, setDark } = useTheme();
  const { user, patchProfile, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [notif, setNotif] = useState(false);
  const [notifHint, setNotifHint] = useState<string | null>(null);

  /** Theme lives on the profile so it follows the account to another device. */
  const toggleTheme = useCallback(async () => {
    const next = !dark;
    setDark(next); // optimistic — the profile sync confirms it
    try {
      await patchProfile({ theme: next ? "dark" : "light" });
    } catch {
      setDark(!next);
    }
  }, [dark, patchProfile, setDark]);

  const startEditing = useCallback(() => {
    setDraftName(user?.displayName || "");
    setProfileError(null);
    setEditing(true);
  }, [user]);

  const saveProfile = useCallback(async () => {
    const name = draftName.trim();
    if (!name) {
      setProfileError("Please enter a name.");
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      await patchProfile({ displayName: name });
      setEditing(false);
    } catch {
      setProfileError("Could not save. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }, [draftName, patchProfile]);

  const changeAvatar = useCallback(
    async (file?: File) => {
      if (!file) return;
      setProfileError(null);
      try {
        await patchProfile({ avatar: await fileToAvatarDataUrl(file) });
      } catch (e) {
        setProfileError(e instanceof Error ? e.message : "That image could not be used.");
      }
    },
    [patchProfile]
  );

  const handleSignOut = useCallback(async () => {
    disableGoogleAutoSelect();
    await signOut();
  }, [signOut]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <Avatar src={user?.avatar} name={user?.displayName || "?"} size={56} />
          <div style={{ minWidth: 0 }}>
            {editing ? (
              <input
                className="input"
                value={draftName}
                maxLength={40}
                autoFocus
                onChange={(e) => setDraftName(e.target.value)}
                aria-label="Display name"
              />
            ) : (
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{user?.displayName || "Pipo Care user"}</div>
            )}
            <div
              className="sub"
              style={{ margin: "4px 0 0", fontSize: "0.85rem", overflowWrap: "anywhere" }}
            >
              {user?.email}
              {user?.provider === "google" ? " · Google account" : " · local test account"}
            </div>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => changeAvatar(e.target.files?.[0])} />

        {profileError && (
          <p role="alert" style={{ color: "var(--bad)", fontSize: "0.82rem", margin: "10px 0 0" }}>
            {profileError}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {editing ? (
            <>
              <button type="button" className="btn-ghost" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save name"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={savingProfile}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="btn-ghost" onClick={startEditing}>
              Edit name
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Change photo
          </button>
          {user?.avatar && (
            <button type="button" className="btn-ghost" onClick={() => patchProfile({ avatar: "" })}>
              Remove photo
            </button>
          )}
        </div>
      </section>

      <section className="card" style={{ padding: 16, marginBottom: 14 }}>
        <h2 className="h1" style={{ fontSize: "1rem", margin: "0 0 4px" }}>
          Your answers
        </h2>
        <p className="sub" style={{ margin: "0 0 12px", fontSize: "0.85rem" }}>
          The setup questions about your eyes are part of how the AI scores your dry-eye risk. Update them whenever
          things change.
        </p>
        <Link to="/welcome?redo=1" className="btn-ghost" style={{ display: "inline-block" }}>
          Review your answers
        </Link>
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
          subtitle="Saved to your profile, so it follows you to any device."
          control={
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              onClick={toggleTheme}
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

      <div style={{ display: "grid", gap: 10 }}>
        <button type="button" className="btn-primary" onClick={handleSignOut}>
          Sign out
        </button>
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
        <p className="sub" style={{ margin: 0, fontSize: "0.75rem" }}>
          Resetting clears device preferences only — your account, profile and monitoring history stay on the server.
        </p>
      </div>
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

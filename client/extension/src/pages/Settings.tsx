import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../../src/components/Avatar";
import { useTheme } from "../../../src/context/ThemeContext";
import { fileToAvatarDataUrl } from "../../../src/lib/avatar";
import { alertSoundEnabled, playAlertChime, setAlertSoundEnabled, unlockAlertSound } from "../../../src/lib/alertSound";
import { clearSessions, fetchSessions } from "../data/localData";
import { useProfile } from "../profile";

const NOTIF_KEY = "pipo-care-notifications";

export function ExtensionSettings() {
  const { dark, setDark } = useTheme();
  const { profile, patch } = useProfile();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notif, setNotif] = useState(false);
  const [notifHint, setNotifHint] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setSound(alertSoundEnabled());
    try {
      setNotif(localStorage.getItem(NOTIF_KEY) === "1");
    } catch {
      setNotif(false);
    }
    fetchSessions()
      .then((s) => setSessionCount(s.length))
      .catch(() => setSessionCount(0));
  }, []);

  const toggleNotif = useCallback(async () => {
    const next = !notif;
    if (next && "Notification" in window) {
      const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (perm !== "granted") {
        setNotifHint("Chrome denied notifications — dryness alerts will stay inside the panel.");
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
  }, [notif]);

  const toggleSound = useCallback(() => {
    const next = !sound;
    setSound(next);
    setAlertSoundEnabled(next);
    if (next) {
      unlockAlertSound();
      playAlertChime();
    }
  }, [sound]);

  const toggleTheme = useCallback(async () => {
    const next = !dark;
    setDark(next);
    await patch({ theme: next ? "dark" : "light" });
  }, [dark, patch, setDark]);

  const saveName = useCallback(async () => {
    const name = draftName.trim();
    if (!name) {
      setProfileError("Please enter a name.");
      return;
    }
    await patch({ displayName: name });
    setEditing(false);
    setProfileError(null);
  }, [draftName, patch]);

  const changeAvatar = useCallback(
    async (file?: File) => {
      if (!file) return;
      setProfileError(null);
      try {
        await patch({ avatar: await fileToAvatarDataUrl(file) });
      } catch (e) {
        setProfileError(e instanceof Error ? e.message : "That image could not be used.");
      }
    },
    [patch]
  );

  const wipe = useCallback(async () => {
    await clearSessions();
    setSessionCount(0);
    setConfirmClear(false);
  }, []);

  return (
    <div className="page">
      <header style={{ marginBottom: 12 }}>
        <h1 className="h1">Settings</h1>
        <p className="sub" style={{ margin: 0 }}>
          Everything here is stored on this computer only.
        </p>
      </header>

      <section className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <Avatar src={profile.avatar} name={profile.displayName || "?"} size={52} />
          <div style={{ minWidth: 0, flex: 1 }}>
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
              <div style={{ fontWeight: 800, fontSize: "1.02rem" }}>{profile.displayName || "Friend"}</div>
            )}
            <div className="sub" style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>
              Local profile · no account
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
              <button type="button" className="btn-ghost" onClick={saveName}>
                Save
              </button>
              <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setDraftName(profile.displayName);
                setEditing(true);
              }}
            >
              Edit name
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Change photo
          </button>
        </div>
      </section>

      <section className="card" style={{ padding: 16, marginBottom: 14 }}>
        <h2 className="h1" style={{ fontSize: "0.98rem", margin: "0 0 4px" }}>
          Your answers
        </h2>
        <p className="sub" style={{ margin: "0 0 12px", fontSize: "0.83rem" }}>
          The setup questions are part of how your dry-eye score is calculated.
        </p>
        <Link to="/welcome?redo=1" className="btn-ghost" style={{ display: "inline-block" }}>
          Review your answers
        </Link>
      </section>

      <section className="card" style={{ padding: 8, marginBottom: 14 }}>
        <Row
          title="Notifications"
          subtitle="Chrome alerts when dryness is detected. They repeat until you have blinked 5 times."
          control={<Switch checked={notif} onClick={toggleNotif} label="Notifications" />}
        />
        {notifHint && (
          <p style={{ color: "var(--warn)", fontSize: "0.83rem", margin: "0 12px 8px" }} role="status">
            {notifHint}
          </p>
        )}
        <Row
          title="Alert sound"
          subtitle="Chime with each reminder while the panel is in the background."
          control={<Switch checked={sound} onClick={toggleSound} label="Alert sound" />}
        />
        <Row
          title="Dark mode"
          subtitle="Match the panel to how you work."
          control={<Switch checked={dark} onClick={toggleTheme} label="Dark mode" />}
        />
      </section>

      <section className="card" style={{ padding: 16, marginBottom: 14 }}>
        <h2 className="h1" style={{ fontSize: "0.98rem", margin: "0 0 4px" }}>
          Your data
        </h2>
        <p className="sub" style={{ margin: "0 0 12px", fontSize: "0.83rem" }}>
          {sessionCount === null ? "Counting…" : `${sessionCount} capture${sessionCount === 1 ? "" : "s"} stored locally.`}{" "}
          Video never leaves your computer — only blink counts are kept.
        </p>
        {confirmClear ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-ghost"
              style={{ borderColor: "var(--bad)", color: "var(--bad)", fontWeight: 700 }}
              onClick={wipe}
            >
              Yes, delete everything
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-ghost"
            style={{ borderColor: "var(--bad)", color: "var(--bad)" }}
            onClick={() => setConfirmClear(true)}
            disabled={!sessionCount}
          >
            Delete all captures
          </button>
        )}
      </section>

      <p className="sub" style={{ fontSize: "0.74rem" }}>
        Pipo Care is a wellness prototype, not a medical device. It does not diagnose or treat eye disease.
      </p>
    </div>
  );
}

function Switch({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      style={{
        width: 50,
        height: 29,
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: checked ? "var(--primary)" : "var(--bg)",
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 24 : 4,
          width: 21,
          height: 21,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          transition: "left 0.15s ease",
        }}
      />
    </button>
  );
}

function Row({ title, subtitle, control }: { title: string; subtitle: string; control: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>{title}</div>
        <div className="sub" style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
          {subtitle}
        </div>
      </div>
      {control}
    </div>
  );
}

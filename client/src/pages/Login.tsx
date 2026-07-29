import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Mascot } from "../components/Mascot";
import { loadGoogleIdentity } from "../lib/googleIdentity";

const POINTS = [
  ["👁️", "Counts your blinks in real time", "On-device vision — video frames never leave your computer or phone."],
  ["💧", "Warns you before your eyes dry out", "A full-screen prompt when your blink rate drops below a safe cadence."],
  ["✨", "Explains what your habits mean", "An AI read-out of your dry-eye risk, built from your own statistics."],
];

export function Login() {
  const { status, user, config, signIn, signInDev } = useAuth();
  const { dark } = useTheme();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCredential = useCallback(
    async (credential?: string) => {
      if (!credential) {
        setError("Google did not return a sign-in token. Please try again.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await signIn(credential);
      } catch {
        setError("We could not verify that Google account. Please try again.");
        setBusy(false);
      }
    },
    [signIn]
  );

  const clientId = config?.googleClientId || "";

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;
    let cancelled = false;

    loadGoogleIdentity()
      .then((gis) => {
        if (cancelled || !buttonRef.current) return;
        gis.initialize({
          client_id: clientId,
          callback: (res) => handleCredential(res.credential),
          cancel_on_tap_outside: true,
        });
        buttonRef.current.replaceChildren();
        gis.renderButton(buttonRef.current, {
          type: "standard",
          theme: dark ? "filled_black" : "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 300,
          logo_alignment: "center",
        });
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach Google sign-in. Check your internet connection.");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, dark, handleCredential]);

  const devSignIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signInDev();
    } catch {
      setError("Local sign-in failed. Is the server still running?");
      setBusy(false);
    }
  }, [signInDev]);

  if (status === "loading") {
    return (
      <div className="auth-screen">
        <p className="sub">Checking your session…</p>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="auth-screen">
      <div className="auth-layout">
        <section className="auth-pitch">
          <h1 className="h1" style={{ fontSize: "2rem" }}>
            Pipo Care
          </h1>
          <p className="sub" style={{ fontSize: "1rem", maxWidth: 420 }}>
            Your eye comfort companion. Sign in to keep your monitoring history, trends and personal dry-eye
            analysis in one place.
          </p>
          <ul className="auth-points">
            {POINTS.map(([icon, title, detail]) => (
              <li key={title}>
                <span className="auth-point-icon" aria-hidden>
                  {icon}
                </span>
                <div>
                  <strong>{title}</strong>
                  <p className="sub" style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>
                    {detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card auth-card">
          <div className="auth-mascot">
            <Mascot />
          </div>
          <h2 className="h1" style={{ fontSize: "1.2rem", textAlign: "center" }}>
            Welcome
          </h2>
          <p className="sub" style={{ textAlign: "center", marginBottom: 20 }}>
            Sign in with Google to get started.
          </p>

          {clientId ? (
            <div className="auth-google" ref={buttonRef} aria-busy={busy} />
          ) : (
            <div className="auth-notice">
              <strong>Google sign-in is not configured</strong>
              <p className="sub" style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "var(--text)" }}>
                Create an OAuth 2.0 Web client in the Google Cloud console, add this origin to its authorised
                JavaScript origins, then start the server with <code>GOOGLE_CLIENT_ID</code> set. The README has
                the full walkthrough.
              </p>
            </div>
          )}

          {busy && (
            <p className="sub" style={{ textAlign: "center", marginTop: 14 }}>
              Signing you in…
            </p>
          )}

          {error && (
            <p role="alert" style={{ color: "var(--bad)", fontWeight: 600, fontSize: "0.85rem", marginTop: 14 }}>
              {error}
            </p>
          )}

          {config?.devLoginEnabled && (
            <>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <button type="button" className="btn-ghost" style={{ width: "100%" }} onClick={devSignIn} disabled={busy}>
                Continue with the local test account
              </button>
              <p className="sub" style={{ margin: "8px 0 0", fontSize: "0.75rem", textAlign: "center" }}>
                Development only — this option is refused in production builds.
              </p>
            </>
          )}

          <p className="sub" style={{ margin: "20px 0 0", fontSize: "0.72rem", textAlign: "center" }}>
            Pipo Care is a wellness prototype, not a medical device. We store your name, email and profile photo
            from Google — nothing else.
          </p>
        </section>
      </div>
    </div>
  );
}

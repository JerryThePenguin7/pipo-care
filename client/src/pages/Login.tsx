import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { loadGoogleIdentity } from "../lib/googleIdentity";

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
          width: 328,
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
      <main className="login-panel">
        <h1 className="brand-mark">
          <span className="brand-mark-accent">Pipo</span> Care
        </h1>
        <p className="login-title">Log in to Pipo Care</p>

        {clientId ? (
          <div className="auth-google" ref={buttonRef} aria-busy={busy} />
        ) : (
          <div className="auth-notice">
            <strong>Google sign-in is not configured</strong>
            <p style={{ margin: "6px 0 0", fontSize: "0.82rem" }}>
              Create an OAuth 2.0 Web client in the Google Cloud console, add this origin to its authorised
              JavaScript origins, then start the server with <code>GOOGLE_CLIENT_ID</code> set. The README has the
              full walkthrough.
            </p>
          </div>
        )}

        {busy && (
          <p className="sub" style={{ margin: "14px 0 0" }}>
            Signing you in…
          </p>
        )}

        {error && (
          <p role="alert" style={{ color: "var(--bad)", fontWeight: 600, fontSize: "0.85rem", margin: "14px 0 0" }}>
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
            <p className="sub" style={{ margin: "8px 0 0", fontSize: "0.75rem" }}>
              Development only — this option is refused in production builds.
            </p>
          </>
        )}

        {/* No separate sign-up: continuing with Google creates the account on first use. */}
        <p className="login-foot">
          New here? Continuing with Google creates your account. Pipo Care is a wellness prototype, not a medical
          device — we store your name, email and profile photo from Google, nothing else.
        </p>
      </main>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { fetchOnboardingSchema, submitOnboarding } from "../api";
import { Avatar } from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { fileToAvatarDataUrl } from "../lib/avatar";
import type { OnboardingSchema, ThemeChoice } from "../types";

const STEPS = ["Profile", "Appearance", "About you"];

export function Onboarding() {
  const { status, user, patchProfile, setUser } = useAuth();
  const { dark, setDark } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  /** Settings → "Review your answers" re-opens this wizard after it has been completed. */
  const redo = params.has("redo");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [theme, setTheme] = useState<ThemeChoice>("light");
  const [schema, setSchema] = useState<OnboardingSchema | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Seed the form from the Google profile the first time the user record arrives.
  const seeded = useRef(false);
  useEffect(() => {
    if (!user || seeded.current) return;
    seeded.current = true;
    setDisplayName(user.displayName || "");
    setAvatar(user.avatar || "");
    setTheme(user.theme || (dark ? "dark" : "light"));
    if (user.onboarding?.scales) setAnswers({ ...user.onboarding.scales });
    if (user.onboarding?.primaryReason) setReason(user.onboarding.primaryReason);
  }, [user, dark]);

  useEffect(() => {
    fetchOnboardingSchema()
      .then(setSchema)
      .catch(() => setError("Could not load the setup questions. Check that the server is running."));
  }, []);

  const pickAvatar = useCallback(async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      setAvatar(await fileToAvatarDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image could not be used.");
    }
  }, []);

  const chooseTheme = useCallback(
    (next: ThemeChoice) => {
      setTheme(next);
      setDark(next === "dark"); // preview it immediately
    },
    [setDark]
  );

  const saveProfileStep = useCallback(async () => {
    const name = displayName.trim();
    if (name.length < 1) {
      setError("Please enter a name — it is what the app greets you with.");
      return;
    }
    if (name.length > 40) {
      setError("That name is a little long; 40 characters max.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patchProfile({ displayName: name, avatar });
      setStep(1);
    } catch {
      setError("Could not save your profile. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [avatar, displayName, patchProfile]);

  const saveThemeStep = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await patchProfile({ theme });
      setStep(2);
    } catch {
      setError("Could not save your theme. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [patchProfile, theme]);

  const finish = useCallback(async () => {
    if (!schema) return;
    const missing = schema.questions.filter((q) => !answers[q.id]);
    if (missing.length > 0) {
      setError("Please answer every statement — each one feeds the analysis.");
      return;
    }
    if (!reason) {
      setError("Pick the reason that fits you best.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { user: updated } = await submitOnboarding({ primaryReason: reason, scales: answers });
      setUser(updated);
      navigate("/", { replace: true });
    } catch {
      setError("Could not save your answers. Please try again.");
      setBusy(false);
    }
  }, [answers, navigate, reason, schema, setUser]);

  if (status === "loading") {
    return (
      <div className="auth-screen">
        <p className="sub">Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.onboarding?.completed && !redo) return <Navigate to="/" replace />;

  return (
    <div className="auth-screen">
      <div className="onboarding-card card">
        <ol className="stepper" aria-label="Setup progress">
          {STEPS.map((label, i) => (
            <li key={label} className={i === step ? "active" : i < step ? "done" : ""}>
              <span className="stepper-dot">{i < step ? "✓" : i + 1}</span>
              <span className="stepper-label">{label}</span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section>
            <h1 className="h1">Make it yours</h1>
            <p className="sub">Choose how Pipo Care should show you around the app.</p>

            <div className="onboarding-avatar-row">
              <Avatar src={avatar} name={displayName || "?"} size={88} ring />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
                  Upload a photo
                </button>
                {avatar && (
                  <button type="button" className="btn-ghost" onClick={() => setAvatar("")}>
                    Remove photo
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => pickAvatar(e.target.files?.[0])}
                />
              </div>
            </div>

            <label className="field">
              <span className="field-label">Display name</span>
              <input
                className="input"
                value={displayName}
                maxLength={40}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we greet you?"
              />
            </label>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="h1">Light or dark?</h1>
            <p className="sub">Pick what is easiest on your eyes. You can change this any time in Settings.</p>

            <div className="theme-choices">
              {(["light", "dark"] as ThemeChoice[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={"theme-choice" + (theme === t ? " active" : "")}
                  onClick={() => chooseTheme(t)}
                  aria-pressed={theme === t}
                >
                  <span className={"theme-preview " + t} aria-hidden>
                    <span className="theme-preview-bar" />
                    <span className="theme-preview-line" />
                    <span className="theme-preview-line short" />
                  </span>
                  <strong>{t === "light" ? "Light" : "Dark"}</strong>
                  <span className="sub" style={{ margin: 0, fontSize: "0.78rem" }}>
                    {t === "light" ? "Bright rooms and daylight" : "Evening use and low light"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="h1">Why are you here?</h1>
            <p className="sub">
              Your answers become part of the AI analysis — the camera can measure your blinking, but only you can
              report how your eyes actually feel.
            </p>

            {!schema && <p className="sub">Loading questions…</p>}

            {schema && (
              <>
                <div className="scale-list">
                  {schema.questions.map((q) => (
                    <fieldset key={q.id} className="scale-item">
                      <legend>{q.text}</legend>
                      <div className="scale-row" role="radiogroup" aria-label={q.text}>
                        {Array.from({ length: schema.scaleMax - schema.scaleMin + 1 }, (_, i) => i + schema.scaleMin).map(
                          (v) => (
                            <button
                              key={v}
                              type="button"
                              role="radio"
                              aria-checked={answers[q.id] === v}
                              className={"scale-dot" + (answers[q.id] === v ? " active" : "")}
                              onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                            >
                              {v}
                            </button>
                          )
                        )}
                      </div>
                      <div className="scale-legend">
                        <span>{q.low}</span>
                        <span>{q.high}</span>
                      </div>
                    </fieldset>
                  ))}
                </div>

                <h2 className="h1" style={{ fontSize: "1rem", margin: "20px 0 8px" }}>
                  What brought you to Pipo Care?
                </h2>
                <div className="reason-list">
                  {schema.reasons.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={"reason-choice" + (reason === r.id ? " active" : "")}
                      onClick={() => setReason(r.id)}
                      aria-pressed={reason === r.id}
                    >
                      <strong>{r.label}</strong>
                      <span className="sub" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                        {r.detail}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {error && (
          <p role="alert" style={{ color: "var(--bad)", fontWeight: 600, fontSize: "0.85rem", marginTop: 14 }}>
            {error}
          </p>
        )}

        <div className="onboarding-actions">
          {step > 0 ? (
            <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={busy}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step === 0 && (
            <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={saveProfileStep} disabled={busy}>
              Continue
            </button>
          )}
          {step === 1 && (
            <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={saveThemeStep} disabled={busy}>
              Continue
            </button>
          )}
          {step === 2 && (
            <button type="button" className="btn-primary" style={{ width: "auto" }} onClick={finish} disabled={busy || !schema}>
              {busy ? "Saving…" : "Finish setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

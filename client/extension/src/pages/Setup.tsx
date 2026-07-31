import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { onboardingSchema } from "../../../../shared/onboarding.js";
import { Avatar } from "../../../src/components/Avatar";
import { useTheme } from "../../../src/context/ThemeContext";
import { fileToAvatarDataUrl } from "../../../src/lib/avatar";
import type { ThemeChoice } from "../../../src/types";
import { useProfile } from "../profile";

const STEPS = ["You", "Look", "Your eyes"];
const SCHEMA = onboardingSchema();

/**
 * First-run setup. Same three steps as the web app — name, theme, and the scale questions
 * that feed the analysis — but there is no account behind it: everything lands in
 * chrome.storage.local on this machine.
 */
export function Setup() {
  const { profile, patch } = useProfile();
  const { dark, setDark } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redo = params.has("redo");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [theme, setTheme] = useState<ThemeChoice>("light");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !profile.createdAt) {
      // Fresh install: still seed the theme from whatever the OS/app is showing.
      if (!seeded.current) setTheme(dark ? "dark" : "light");
      return;
    }
    seeded.current = true;
    setDisplayName(profile.displayName || "");
    setAvatar(profile.avatar || "");
    setTheme(profile.theme || (dark ? "dark" : "light"));
    if (profile.onboarding?.scales) setAnswers({ ...profile.onboarding.scales });
    if (profile.onboarding?.primaryReason) setReason(profile.onboarding.primaryReason);
  }, [profile, dark]);

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
      setDark(next === "dark");
    },
    [setDark]
  );

  const finish = useCallback(async () => {
    if (SCHEMA.questions.some((q) => !answers[q.id])) {
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
      await patch({
        displayName: displayName.trim() || "Friend",
        avatar,
        theme,
        onboarding: { completed: true, completedAt: Date.now(), primaryReason: reason, scales: answers },
      });
      navigate("/", { replace: true });
    } catch {
      setError("Could not save your answers. Please try again.");
      setBusy(false);
    }
  }, [answers, avatar, displayName, navigate, patch, reason, theme]);

  return (
    <div className="ext-setup">
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
            <h1 className="h1">Welcome to Pipo Care</h1>
            <p className="sub">
              Everything stays on this computer — no account, no sign-in, nothing uploaded.
            </p>
            <div className="onboarding-avatar-row">
              <Avatar src={avatar} name={displayName || "?"} size={72} ring />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
                  Add a photo
                </button>
                {avatar && (
                  <button type="button" className="btn-ghost" onClick={() => setAvatar("")}>
                    Remove
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickAvatar(e.target.files?.[0])} />
              </div>
            </div>
            <label className="field">
              <span className="field-label">What should we call you?</span>
              <input
                className="input"
                value={displayName}
                maxLength={40}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </label>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="h1">Light or dark?</h1>
            <p className="sub">Pick what is easiest on your eyes. Changeable any time in Settings.</p>
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
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="h1">How are your eyes?</h1>
            <p className="sub">
              The camera can measure your blinking, but only you can say how your eyes feel. These
              answers become part of your dry-eye score.
            </p>

            <div className="scale-list">
              {SCHEMA.questions.map((q) => (
                <fieldset key={q.id} className="scale-item">
                  <legend>{q.text}</legend>
                  <div className="scale-row" role="radiogroup" aria-label={q.text}>
                    {Array.from({ length: SCHEMA.scaleMax - SCHEMA.scaleMin + 1 }, (_, i) => i + SCHEMA.scaleMin).map(
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

            <h2 className="h1" style={{ fontSize: "0.95rem", margin: "18px 0 8px" }}>
              What brought you here?
            </h2>
            <div className="reason-list">
              {SCHEMA.reasons.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={"reason-choice" + (reason === r.id ? " active" : "")}
                  onClick={() => setReason(r.id)}
                  aria-pressed={reason === r.id}
                >
                  <strong>{r.label}</strong>
                  <span className="sub" style={{ margin: "2px 0 0", fontSize: "0.78rem" }}>
                    {r.detail}
                  </span>
                </button>
              ))}
            </div>
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
          ) : redo ? (
            <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
              Cancel
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="btn-primary"
            style={{ width: "auto" }}
            onClick={step === 2 ? finish : () => setStep((s) => s + 1)}
            disabled={busy}
          >
            {step === 2 ? (busy ? "Saving…" : "Finish") : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

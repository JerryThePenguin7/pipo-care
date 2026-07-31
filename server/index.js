import express from "express";
import cors from "cors";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import {
  claimLegacySessions,
  readSessions,
  readSessionsForUser,
  readUsers,
  saveUser,
  writeSessions,
} from "./db.js";
import { analyzeSessions, DEFAULT_OPTIONS as ANALYSIS_DEFAULTS } from "../shared/analysis.js";
import { onboardingSchema, validateOnboarding } from "../shared/onboarding.js";
import {
  clearSessionCookie,
  devLoginEnabled,
  googleClientId,
  publicUser,
  requireAuth,
  setSessionCookie,
  signSession,
  verifyGoogleIdToken,
} from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;
/** Bind to all interfaces so phones on the same Wi‑Fi can reach production mode. */
const HOST = process.env.HOST || "0.0.0.0";
const isProd = process.env.NODE_ENV === "production";

app.use(cors());
/** Limit covers a session payload plus an onboarding avatar (client downscales to ~256px). */
app.use(express.json({ limit: "3mb" }));

function validateSession(body) {
  if (!body || typeof body !== "object") return "Invalid body";
  const nums = ["startedAt", "endedAt", "blinkCount", "avgBlinksPerMin"];
  for (const k of nums) {
    if (body[k] === undefined || body[k] === null) return `Missing ${k}`;
  }
  if (!["healthy", "medium", "slightly_dry", "dry"].includes(body.status)) {
    return "Invalid status";
  }
  if (!Array.isArray(body.samples)) return "samples must be an array";
  return null;
}

/* ------------------------------------------------------------------- auth */

/** What the login page needs to know before it can render a sign-in button. */
app.get("/api/auth/config", (_req, res) => {
  res.json({ googleClientId: googleClientId(), devLoginEnabled: devLoginEnabled() });
});

/**
 * Create or refresh an account from a Google ID token.
 * The very first account on an install adopts any pre-accounts monitoring history.
 */
app.post("/api/auth/google", async (req, res) => {
  try {
    const claims = await verifyGoogleIdToken(req.body?.credential);
    const existing = readUsers().find((u) => u.id === claims.sub);
    const firstEver = readUsers().length === 0;
    const now = Date.now();

    const user = saveUser(
      existing
        ? { id: claims.sub, email: claims.email, lastLoginAt: now }
        : {
            id: claims.sub,
            provider: "google",
            email: claims.email,
            emailVerified: claims.emailVerified,
            displayName: claims.name || claims.email.split("@")[0] || "Pipo user",
            avatar: claims.picture || "",
            theme: "light",
            onboarding: { completed: false },
            createdAt: now,
            lastLoginAt: now,
          }
    );

    if (firstEver) claimLegacySessions(user.id);
    setSessionCookie(req, res, signSession(user.id));
    res.json({ user: publicUser(user) });
  } catch (e) {
    console.error("Google sign-in failed:", e.message);
    res.status(401).json({ error: "Google sign-in could not be verified" });
  }
});

/**
 * Local test account so the app can be exercised without a Google Cloud project.
 * Disabled unless PIPO_ALLOW_DEV_LOGIN=1, and always refused in production.
 */
app.post("/api/auth/dev-login", (req, res) => {
  if (!devLoginEnabled()) return res.status(404).json({ error: "Not available" });

  const id = "dev-local-user";
  const existing = readUsers().find((u) => u.id === id);
  const firstEver = readUsers().length === 0;
  const now = Date.now();

  const user = saveUser(
    existing
      ? { id, lastLoginAt: now }
      : {
          id,
          provider: "dev",
          email: "dev@localhost",
          emailVerified: false,
          displayName: "Local tester",
          avatar: "",
          theme: "light",
          onboarding: { completed: false },
          createdAt: now,
          lastLoginAt: now,
        }
  );

  if (firstEver) claimLegacySessions(user.id);
  setSessionCookie(req, res, signSession(user.id));
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

/* ---------------------------------------------------------------- profile */

app.get("/api/onboarding/schema", (_req, res) => {
  res.json(onboardingSchema());
});

/** Profile customisation: display name, avatar and theme. */
app.patch("/api/me", requireAuth, (req, res) => {
  const patch = { id: req.user.id };

  if (req.body.displayName !== undefined) {
    const name = String(req.body.displayName).trim();
    if (name.length < 1 || name.length > 40) {
      return res.status(400).json({ error: "Display name must be 1-40 characters" });
    }
    patch.displayName = name;
  }

  if (req.body.avatar !== undefined) {
    const avatar = String(req.body.avatar);
    const ok = avatar === "" || /^data:image\/(png|jpeg|webp);base64,/.test(avatar) || /^https:\/\//.test(avatar);
    if (!ok) return res.status(400).json({ error: "Avatar must be an https URL or an image data URL" });
    if (avatar.length > 2_000_000) return res.status(400).json({ error: "Avatar image is too large" });
    patch.avatar = avatar;
  }

  if (req.body.theme !== undefined) {
    if (!["light", "dark"].includes(req.body.theme)) {
      return res.status(400).json({ error: "Theme must be light or dark" });
    }
    patch.theme = req.body.theme;
  }

  res.json({ user: publicUser(saveUser(patch)) });
});

/** Onboarding answers — these feed the self-report factor of the analysis. */
app.post("/api/me/onboarding", requireAuth, (req, res) => {
  const result = validateOnboarding(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ user: publicUser(saveUser({ id: req.user.id, onboarding: result.value })) });
});

/* --------------------------------------------------------------- sessions */

app.get("/api/sessions", requireAuth, (req, res) => {
  res.json(readSessionsForUser(req.user.id).sort((a, b) => b.startedAt - a.startedAt));
});

/**
 * Dry-eye risk read-out derived from the signed-in user's session statistics and
 * their onboarding answers. Optional `?days=` narrows or widens the window (default 14).
 */
app.get("/api/analysis", requireAuth, (req, res) => {
  const raw = req.query.days;
  let windowDays = ANALYSIS_DEFAULTS.windowDays;
  if (raw !== undefined) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      return res.status(400).json({ error: "days must be a number between 1 and 365" });
    }
    windowDays = n;
  }
  res.json(analyzeSessions(readSessionsForUser(req.user.id), { windowDays, profile: req.user }));
});

app.get("/api/sessions/:id", requireAuth, (req, res) => {
  const s = readSessionsForUser(req.user.id).find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: "Not found" });
  res.json(s);
});

app.post("/api/sessions", requireAuth, (req, res) => {
  const err = validateSession(req.body);
  if (err) return res.status(400).json({ error: err });

  const session = {
    id: uuidv4(),
    userId: req.user.id,
    startedAt: Number(req.body.startedAt),
    endedAt: Number(req.body.endedAt),
    durationMs: Number(req.body.durationMs) || Number(req.body.endedAt) - Number(req.body.startedAt),
    blinkCount: Number(req.body.blinkCount),
    avgBlinksPerMin: Number(req.body.avgBlinksPerMin),
    minBpm: req.body.minBpm != null ? Number(req.body.minBpm) : null,
    maxBpm: req.body.maxBpm != null ? Number(req.body.maxBpm) : null,
    status: req.body.status,
    samples: req.body.samples,
    alertsTriggered: Number(req.body.alertsTriggered) || 0,
    notes: req.body.notes || "",
    createdAt: Date.now(),
  };

  const sessions = readSessions();
  sessions.push(session);
  writeSessions(sessions);
  res.status(201).json(session);
});

app.delete("/api/sessions/:id", requireAuth, (req, res) => {
  const sessions = readSessions();
  const next = sessions.filter((x) => !(x.id === req.params.id && x.userId === req.user.id));
  if (next.length === sessions.length) return res.status(404).json({ error: "Not found" });
  writeSessions(next);
  res.json({ ok: true });
});

if (isProd) {
  const clientDist = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

function lanIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const v4 = net.family === "IPv4" || net.family === 4;
      if (v4 && !net.internal) return net.address;
    }
  }
  return null;
}

app.listen(PORT, HOST, () => {
  console.log(`Pipo Care API http://localhost:${PORT}`);
  if (HOST === "0.0.0.0") {
    const ip = lanIPv4();
    if (ip) console.log(`On your LAN:     http://${ip}:${PORT}`);
  }
  if (!googleClientId()) {
    console.log("⚠  GOOGLE_CLIENT_ID is not set — Google sign-in is disabled.");
    if (devLoginEnabled()) console.log("   PIPO_ALLOW_DEV_LOGIN=1 — local test account is available.");
  }
});

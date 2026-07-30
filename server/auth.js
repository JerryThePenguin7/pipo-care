/**
 * Google sign-in + session cookies.
 *
 * Flow: the browser gets an ID token from Google Identity Services, POSTs it to
 * /api/auth/google, and the server verifies that token against Google's public keys
 * (google-auth-library) before issuing its own signed session cookie. The Google
 * credential is never stored — only the account's `sub`, email, name and picture.
 *
 * Configuration (environment):
 *   GOOGLE_CLIENT_ID     OAuth 2.0 Web client ID. Required for real sign-in.
 *   SESSION_SECRET       HMAC key for session cookies. Auto-generated and persisted
 *                        under server/data/ when unset (fine locally, set it in prod).
 *   PIPO_ALLOW_DEV_LOGIN Set to "1" to expose a local test account. Refused when
 *                        NODE_ENV=production — see devLoginEnabled().
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { OAuth2Client } from "google-auth-library";
import { findUserById } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRET_PATH = path.join(__dirname, "data", ".session-secret");

export const COOKIE_NAME = "pipo_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const isProd = () => process.env.NODE_ENV === "production";

export function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID || "";
}

/**
 * The dev account exists so the app can be run end to end without a Google Cloud
 * project. It is opt-in and hard-refused in production — never ship with it on.
 */
export function devLoginEnabled() {
  return !isProd() && process.env.PIPO_ALLOW_DEV_LOGIN === "1";
}

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    if (fs.existsSync(SECRET_PATH)) return fs.readFileSync(SECRET_PATH, "utf8").trim();
    const generated = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true });
    fs.writeFileSync(SECRET_PATH, generated, "utf8");
    return generated;
  } catch {
    // Read-only disk: fall back to a per-process key. Sessions then end with the process.
    return crypto.randomBytes(32).toString("hex");
  }
}

/* ------------------------------------------------------------ session token */

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function hmac(data) {
  return crypto.createHmac("sha256", sessionSecret()).update(data).digest("base64url");
}

export function signSession(userId) {
  const payload = b64url(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_MAX_AGE_MS }));
  return `${payload}.${hmac(payload)}`;
}

export function verifySession(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.uid || !data.exp || Date.now() > data.exp) return null;
    return data.uid;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ cookies */

export function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Secure is set only over HTTPS: production mode is plain HTTP on localhost (see README). */
function isSecureRequest(req) {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

export function setSessionCookie(req, res, token) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`,
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(req, res) {
  const parts = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isSecureRequest(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

/* ------------------------------------------------------------ google verify */

let client = null;

/**
 * Verify a Google ID token and return the identity claims.
 * Throws when the token is invalid, expired or issued for another client.
 */
export async function verifyGoogleIdToken(credential) {
  const clientId = googleClientId();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured on the server");
  if (!credential || typeof credential !== "string") throw new Error("Missing Google credential");

  if (!client) client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error("Google token had no subject");

  return {
    sub: payload.sub,
    email: payload.email || "",
    emailVerified: Boolean(payload.email_verified),
    name: payload.name || "",
    picture: payload.picture || "",
  };
}

/* --------------------------------------------------------------- middleware */

/** Attaches req.user, or answers 401 so the client can bounce to the login page. */
export function requireAuth(req, res, next) {
  const uid = verifySession(parseCookies(req)[COOKIE_NAME]);
  if (!uid) return res.status(401).json({ error: "Not signed in" });

  const user = findUserById(uid);
  if (!user) {
    clearSessionCookie(req, res);
    return res.status(401).json({ error: "Account no longer exists" });
  }
  req.user = user;
  next();
}

/** Strips anything the browser has no business seeing before a user goes over the wire. */
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatar: user.avatar || "",
    theme: user.theme || "light",
    provider: user.provider,
    onboarding: user.onboarding || { completed: false },
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

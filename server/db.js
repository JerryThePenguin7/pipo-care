import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const SESSIONS_PATH = path.join(DATA_DIR, "sessions.json");
const USERS_PATH = path.join(DATA_DIR, "users.json");

function ensureFile(file, seed) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(seed, null, 2), "utf8");
}

function readList(file, key) {
  ensureFile(file, { [key]: [] });
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(data[key]) ? data[key] : [];
  } catch {
    return [];
  }
}

function writeList(file, key, list) {
  ensureFile(file, { [key]: [] });
  fs.writeFileSync(file, JSON.stringify({ [key]: list }, null, 2), "utf8");
}

/* ------------------------------------------------------------- sessions */

export function readSessions() {
  return readList(SESSIONS_PATH, "sessions");
}

export function writeSessions(sessions) {
  writeList(SESSIONS_PATH, "sessions", sessions);
}

/** Monitoring history belonging to one account. */
export function readSessionsForUser(userId) {
  return readSessions().filter((s) => s.userId === userId);
}

/**
 * One-time migration: history recorded before accounts existed carries no userId.
 * The first account created on this install adopts it, so an existing user keeps
 * their sessions — and their AI analysis — after signing in for the first time.
 */
export function claimLegacySessions(userId) {
  const sessions = readSessions();
  let claimed = 0;
  for (const s of sessions) {
    if (!s.userId) {
      s.userId = userId;
      claimed += 1;
    }
  }
  if (claimed) writeSessions(sessions);
  return claimed;
}

/* ---------------------------------------------------------------- users */

export function readUsers() {
  return readList(USERS_PATH, "users");
}

export function writeUsers(users) {
  writeList(USERS_PATH, "users", users);
}

export function findUserById(id) {
  return readUsers().find((u) => u.id === id) || null;
}

/** Insert a user or merge changes into the existing record, then return it. */
export function saveUser(user) {
  const users = readUsers();
  const i = users.findIndex((u) => u.id === user.id);
  if (i >= 0) users[i] = { ...users[i], ...user };
  else users.push(user);
  writeUsers(users);
  return i >= 0 ? users[i] : users[users.length - 1];
}

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "sessions.json");

function ensureFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ sessions: [] }, null, 2), "utf8");
  }
}

export function readSessions() {
  ensureFile();
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.sessions) ? data.sessions : [];
  } catch {
    return [];
  }
}

export function writeSessions(sessions) {
  ensureFile();
  fs.writeFileSync(DATA_PATH, JSON.stringify({ sessions }, null, 2), "utf8");
}

import express from "express";
import cors from "cors";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { readSessions, writeSessions } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;
/** Bind to all interfaces so phones on the same Wi‑Fi can reach production mode. */
const HOST = process.env.HOST || "0.0.0.0";
const isProd = process.env.NODE_ENV === "production";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

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

app.get("/api/sessions", (_req, res) => {
  const sessions = readSessions().sort((a, b) => b.startedAt - a.startedAt);
  res.json(sessions);
});

app.get("/api/sessions/:id", (req, res) => {
  const sessions = readSessions();
  const s = sessions.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: "Not found" });
  res.json(s);
});

app.post("/api/sessions", (req, res) => {
  const err = validateSession(req.body);
  if (err) return res.status(400).json({ error: err });

  const session = {
    id: uuidv4(),
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

app.delete("/api/sessions/:id", (req, res) => {
  const sessions = readSessions();
  const next = sessions.filter((x) => x.id !== req.params.id);
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
});

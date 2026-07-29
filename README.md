# Pipo Care

Web prototype for eye-comfort monitoring (blink rate, session history). This README explains how to install and open the site **on your computer**.

## What you need

- **Node.js** version **18** or **20** (LTS recommended).  
  Download: [https://nodejs.org](https://nodejs.org)
- A modern browser (**Chrome**, **Edge**, or **Firefox**).
- **Internet connection** the first time you use monitoring (the app downloads vision models).

## Get the project on your machine

1. Unzip the project folder (or clone the repository) to a path you can find, for example `Documents\Pipo care`.
2. Open a terminal in that folder:
   - **Windows:** Shift + right-click in the folder → “Open in Terminal”, or open **PowerShell** / **Command Prompt** and run `cd` to the folder.

## Install dependencies

In the project root (the folder that contains `package.json`, `server`, and `client`), run:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

Wait until each command finishes without errors.

---

## Recommended: run the full site (production mode)

This builds the web UI and starts one local server. You open **one address** in the browser.

### Windows (PowerShell)

```powershell
npm run build --prefix client
$env:NODE_ENV = "production"
npm run start --prefix server
```

### Windows (Command Prompt)

```cmd
npm run build --prefix client
set NODE_ENV=production
npm run start --prefix server
```

### macOS or Linux

```bash
npm run build --prefix client
NODE_ENV=production npm run start --prefix server
```

You should see something like: `Pipo Care API http://localhost:3001`

### Open the site

In your browser, go to:

**[http://localhost:3001](http://localhost:3001)**

Allow **camera** access when the browser asks (required for monitoring).

To stop the server, press **Ctrl+C** in the terminal.

---

## Optional: developer mode (two servers, live reload)

Use this if you are changing code. From the project root:

```bash
npm run dev
```

- On **this PC:** open **[https://localhost:5173](https://localhost:5173)** (your browser may warn once about the dev certificate — continue for local testing only).  
- The API runs at **http://localhost:3001** (Vite proxies `/api` to it automatically).

---

## Host on your local network (phone / other PCs on Wi‑Fi)

The dev server uses **HTTPS** and listens on **all interfaces** (`0.0.0.0`), port **5173**. That is required so **mobile Chrome can use the camera** (plain `http://192.168.x.x` is not a “secure context”, so the camera API is blocked and you may never see a permission prompt).

1. Start the app: `npm run dev` (from the project root).
2. In the terminal, Vite prints a **Network** line, for example:  
   **`https://192.168.1.55:5173`** (note **https**).
3. On your phone (same Wi‑Fi), open that **https** URL in **Chrome**.

**First time on the phone (certificate):** The dev server uses a **self-signed** certificate. In Chrome: **Advanced** → **Proceed to … (unsafe)** — this is normal for local prototypes, not for public production sites.

**Then:** open **Monitoring** → **Start capture** → Chrome should ask to **allow Camera**.

**Windows firewall:** Allow **inbound** TCP on **5173** and **3001** (or allow **Node.js** when Windows prompts you).

**Production mode on the LAN:** The built app served with `NODE_ENV=production` is still **HTTP** on port **3001**, so **phone cameras may stay blocked** until you put the app behind real **HTTPS** (hosting, reverse proxy, or a tunnel). For phone testing during development, prefer **`npm run dev`** with the **https://** LAN URL above.

---

## AI dry-eye analysis (home screen)

The home screen shows an automated dry-eye read-out built from the statistics Pipo Care already stores.
It replaces the old 7-day session list.

- **Engine:** `server/analysis.js` (pure functions, no I/O)
- **API:** `GET /api/analysis` — optional `?days=` window, default **14** (1-365)
- **UI:** `client/src/components/AiAnalysisCard.tsx`, rendered by `client/src/pages/Home.tsx`

It returns a **0-100 risk index** (Low → Mild → Moderate → High), the signals that produced it, what to do
about each one, and a confidence rating based on how much usable data you have. Nothing is hidden: every
point of the score is attributed to a factor you can see on screen.

### How the score is built

| Factor | Weight | What it measures |
|--------|--------|------------------|
| Average blink rate | 34% | Duration-weighted mean blinks/min. ≥15 is healthy, <7 is the app's dryness threshold. |
| Time in the dryness band | 22% | Share of monitored time spent under 7 (and under 10) blinks/min. |
| Blink-free staring gaps | 18% | Longest stretch with no blink at all, plus how often gaps over 10 s occur. |
| Repeat dryness alerts | 10% | Alerts *beyond the first* per 10 minutes of monitoring. |
| Blink decay during sessions | 10% | Slope of blink rate across a session — the tear-film fatigue curve. |
| Trend vs earlier sessions | 6% | Recent half of the window against the earlier half. |

Factors that lack data (too few samples, sessions too short) are dropped and the remaining weights are
re-normalised, so a short history still produces a usable — if low-confidence — score.

### Three data quirks the rules work around

1. `SamplePoint.bpm` counts blinks in the **trailing 60 s**, so samples before `t = 60 s` always read low.
   Exposure and decay factors ignore them.
2. `avgBlinksPerMin` is `blinkCount / elapsed minutes`, which is unbiased at any length — that is why it
   drives the heaviest factor.
3. Because of (1), nearly every session logs one dryness alert during its first minute. Only *excess*
   alerts, on sessions of 90 s or more, count towards risk.

Captures shorter than 15 s or with fewer than 3 samples are excluded as noise, and the card reports how
many were skipped.

### Testing the engine

```bash
npm test --prefix server
```

This is a **rule-based, explainable model**, not a trained classifier and not a diagnosis — the prototype
does not have anywhere near enough data to fit one, and a user needs to see *why* a score moved. It flags
risk indicators for a wellness prompt; only an eye-care professional can diagnose dry eye disease.

---

## Where session data is saved

Monitoring history is stored on disk at:

`server/data/sessions.json`

Back up or delete this file if you want to reset history.

---

## Troubleshooting

| Problem | What to try |
|--------|-------------|
| `npm` is not recognized | Install Node.js from nodejs.org and restart the terminal. |
| Port 3001 already in use | Close other apps using that port, or set another port: `set PORT=3002` (Windows CMD) / `$env:PORT=3002` (PowerShell) before `npm run start --prefix server`, then open `http://localhost:3002`. |
| LAN devices cannot connect | Confirm same Wi‑Fi; open firewall for 5173 + 3001 (dev) or 3001 only (production); use the **Network** URL from the terminal, not `localhost`. |
| Page is blank after build | Run `npm run build --prefix client` again; ensure `NODE_ENV=production` when starting the server. |
| Camera does not work on phone | Use the **https://** “Network” URL from `npm run dev` (not `http://`). Trust the certificate warning once, then allow Camera. |
| Eye tracking never starts | Check internet; wait for model download; try a different browser. |

---

## Disclaimer

Pipo Care is a **wellness / educational prototype**, not a medical device. It does not diagnose or treat eye disease.

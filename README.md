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

## Set up Google sign-in

Pipo Care requires an account. Sign-in uses **Google Identity Services**: the browser gets an ID token
from Google, the server verifies it against Google's public keys, and only then issues its own session
cookie. You need a free OAuth client ID before anyone can sign in.

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create (or pick) a project.
2. Go to **APIs & Services → OAuth consent screen** and complete the basic details. While the app is in
   *Testing*, add your own Google address under **Test users**.
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**
   - **Authorised JavaScript origins** — add every address you will open the app from:
     - `http://localhost:3001` (production mode on this PC)
     - `https://localhost:5173` (developer mode)
     - `https://192.168.x.x:5173` (your LAN IP, for phone testing)
   - You do **not** need a redirect URI — this flow never leaves the page.
4. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
5. Start the server with it set:

   ```powershell
   $env:GOOGLE_CLIENT_ID = "1234567890-abcdef.apps.googleusercontent.com"
   ```

If the origin you open the app from is not on that list, Google refuses to render the button — add the
address and reload.

### Server environment variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Web client ID. Without it the login page explains that sign-in is unconfigured. |
| `SESSION_SECRET` | Key used to sign session cookies. Generated and saved to `server/data/.session-secret` when unset — **set it explicitly in production**, otherwise everyone is signed out whenever that file is lost. |
| `PIPO_ALLOW_DEV_LOGIN` | Set to `1` to expose a local test account so you can click through the app without a Google project. Refused whenever `NODE_ENV=production`. Never enable it on a public deployment. |
| `PORT` / `HOST` | Listen address (defaults `3001` / `0.0.0.0`). |

### Trying it without a Google project

```powershell
$env:PIPO_ALLOW_DEV_LOGIN = "1"
npm run dev
```

The login page then offers **Continue with the local test account**. This is a development seam, not a
back door: with `NODE_ENV=production` the endpoint returns 404 no matter what the variable says.

### First sign-in adopts existing history

Monitoring sessions recorded before accounts existed have no owner. The **first account created on an
install** claims them, so upgrading an existing Pipo Care folder keeps its history and its AI analysis.
Every account created afterwards starts empty and only ever sees its own sessions.

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
| Average blink rate | 34 | Duration-weighted mean blinks/min. ≥15 is healthy, <7 is the app's dryness threshold. |
| Time in the dryness band | 22 | Share of monitored time spent under 7 (and under 10) blinks/min. |
| Blink-free staring gaps | 18 | Longest stretch with no blink at all, plus how often gaps over 10 s occur. |
| Symptoms you reported | 14 | Your onboarding answers — discomfort, strain, reliance on relief, screen exposure. |
| Repeat dryness alerts | 10 | Alerts *beyond the first* per 10 minutes of monitoring. |
| Blink decay during sessions | 10 | Slope of blink rate across a session — the tear-film fatigue curve. |
| Trend vs earlier sessions | 6 | Recent half of the window against the earlier half. |

Weights are relative, not percentages: the score is the weighted mean of whichever factors had data.

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

### The onboarding answers

The camera measures blink mechanics; it cannot feel grit, burning or blurred vision. The setup questions
(Settings → **Review your answers**) supply that missing half. They are deliberately close to the
statements used by dry-eye symptom questionnaires such as OSDI and DEQ-5, and they carry less weight than
the measured blink rate because self-reports drift while the camera data changes day to day. The most
useful thing the combination produces: **symptoms with a healthy measured blink rate** points away from
blink frequency and towards evaporation or tear quality — air conditioning, low humidity, contact lenses —
which no amount of blinking practice fixes. The card says so explicitly when it sees that pattern.

### Testing the engine

```bash
npm test --prefix server
```

This is a **rule-based, explainable model**, not a trained classifier and not a diagnosis — the prototype
does not have anywhere near enough data to fit one, and a user needs to see *why* a score moved. It flags
risk indicators for a wellness prompt; only an eye-care professional can diagnose dry eye disease.

---

## Accounts, profiles and onboarding

After the first sign-in the app walks you through a three-step setup:

1. **Profile** — display name and photo (seeded from your Google account; you can upload your own, which
   is cropped square and downscaled to 256 px in the browser before upload).
2. **Appearance** — light or dark. The choice is stored on your profile, so it follows you to any device.
3. **About you** — four 1-5 statements about how your eyes feel plus the reason you are here. These feed
   the AI analysis (see above) and can be updated any time from Settings.

You cannot reach the app until setup is finished; signing out is in Settings and in the desktop sidebar.

## Screen sizes

One layout, two shapes:

- **Phone (under 768 px)** — single column, bottom tab bar, avatar in the header as the account shortcut.
- **Tablet and desktop (768 px and up)** — fixed sidebar with the account and sign-out, wider content,
  four-across metric tiles, taller charts, and a two-column history grid (three columns past 1200 px).

The breakpoints live entirely in `client/src/index.css`; both navigations are always rendered and CSS
decides which one is visible, so navigation never depends on a JavaScript media query.

## Where data is saved

| File | Contents |
|------|----------|
| `server/data/sessions.json` | All monitoring sessions, each tagged with its owner's `userId`. |
| `server/data/users.json` | Accounts: Google `sub`, email, display name, avatar, theme, onboarding answers. |
| `server/data/.session-secret` | Auto-generated cookie signing key. Never commit it; delete it to invalidate every session. |

Delete `sessions.json` to reset history, or `users.json` to remove all accounts.

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
| Google button does not appear | `GOOGLE_CLIENT_ID` is unset, or the address you opened is missing from the client's **Authorised JavaScript origins**. Add it and reload. |
| “Google sign-in could not be verified” | The ID token was issued for a different client ID than the server is configured with. Check both ends match. |
| Signed out unexpectedly | Sessions last 30 days. Deleting `server/data/.session-secret`, or restarting with a different `SESSION_SECRET`, invalidates every session. |
| History looks empty after signing in | Only the *first* account on an install adopts pre-accounts sessions. Later accounts start empty — that is by design. |

---

## Disclaimer

Pipo Care is a **wellness / educational prototype**, not a medical device. It does not diagnose or treat eye disease.

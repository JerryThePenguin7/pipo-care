import { defineConfig } from "vite";
import path from "node:path";
import fs from "node:fs";
import react from "@vitejs/plugin-react";

/**
 * Chrome extension (MV3) build.
 *
 * Differences from the web build that matter:
 *  - "@data" resolves to the chrome.storage layer instead of the REST client, so the same
 *    Monitor/History/Insights pages work with no server behind them.
 *  - The service worker is a second entry with a fixed filename, because manifest.json has
 *    to reference it by name and cannot use a hashed asset.
 *  - Everything in extension/public (MediaPipe WASM, the face model, icons) is copied
 *    verbatim: MV3 forbids remotely-hosted code, so those cannot come from a CDN.
 *
 * Output: client/dist-extension — that folder is what you load unpacked, and what you zip
 * for the Chrome Web Store.
 */
const outDir = path.resolve(__dirname, "dist-extension");

/** manifest.json is not referenced by any bundle, so copy it in ourselves. */
function copyManifest() {
  return {
    name: "pipo-copy-manifest",
    closeBundle() {
      fs.copyFileSync(
        path.resolve(__dirname, "extension/manifest.json"),
        path.join(outDir, "manifest.json")
      );
    },
  };
}

/**
 * Copy the MediaPipe WASM runtime out of node_modules at build time.
 *
 * It has to be inside the package (MV3 bans remotely-hosted code) but it does not belong in
 * git: it is ~19 MB and it must match the installed @mediapipe/tasks-vision exactly. Taking
 * it from node_modules on every build means upgrading the dependency cannot leave a stale
 * runtime behind. The face model is committed instead — that one is not an npm artefact.
 */
function copyMediaPipeWasm() {
  return {
    name: "pipo-copy-mediapipe-wasm",
    closeBundle() {
      const from = path.resolve(__dirname, "node_modules/@mediapipe/tasks-vision/wasm");
      if (!fs.existsSync(from)) {
        throw new Error(
          "@mediapipe/tasks-vision is not installed — run `npm install` in client/ before building the extension."
        );
      }
      const to = path.join(outDir, "vision");
      fs.mkdirSync(to, { recursive: true });
      for (const file of fs.readdirSync(from)) {
        fs.copyFileSync(path.join(from, file), path.join(to, file));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyManifest(), copyMediaPipeWasm()],
  // Root is the extension folder so panel.html lands at the top of dist-extension
  // (the manifest references it as "panel.html", not "extension/panel.html").
  root: path.resolve(__dirname, "extension"),
  publicDir: path.resolve(__dirname, "extension/public"),
  base: "./",
  resolve: {
    alias: { "@data": path.resolve(__dirname, "extension/src/data/localData.ts") },
  },
  build: {
    outDir,
    emptyOutDir: true,
    // Chrome ships a current engine; no need to down-level.
    target: "chrome116",
    rollupOptions: {
      input: {
        panel: path.resolve(__dirname, "extension/panel.html"),
        background: path.resolve(__dirname, "extension/src/background.ts"),
      },
      output: {
        // background.js must keep its name for the manifest; everything else can hash.
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});

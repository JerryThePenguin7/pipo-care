/**
 * Where the MediaPipe runtime and model are loaded from.
 *
 * The web app pulls both from Google's CDN. The Chrome extension cannot: MV3 forbids
 * executing remotely-hosted code, so it ships the WASM and the .task model inside the
 * package and points these at chrome-extension:// URLs during startup. Keeping the
 * locations in one place means useBlinkTracker stays identical for both targets.
 */

export type VisionAssets = {
  /** Directory containing vision_wasm_internal.js/.wasm (no trailing slash). */
  wasmBase: string;
  /** Full URL of face_landmarker.task. */
  modelUrl: string;
};

const CDN: VisionAssets = {
  wasmBase: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm",
  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
};

let current: VisionAssets = CDN;

export function setVisionAssets(assets: VisionAssets) {
  current = assets;
}

export function visionAssets(): VisionAssets {
  return current;
}

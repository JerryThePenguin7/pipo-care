/**
 * A way out when the camera cannot be requested from the current surface.
 *
 * Chrome will not render a permission prompt inside an extension side panel, so
 * getUserMedia there rejects with NotAllowedError and the user never sees a bubble.
 * The cure is to grant once from a normal tab on the same extension origin; the panel
 * inherits the grant afterwards.
 *
 * Monitor is shared with the web app, which has no such problem, so the recovery action
 * is injected the same way the data layer and notifier are — see extension/src/main.tsx.
 */

export type CameraRecovery = {
  title: string;
  detail: string;
  actionLabel: string;
  run: () => void;
};

let provider: () => CameraRecovery | null = () => null;

export function setCameraRecoveryProvider(fn: () => CameraRecovery | null) {
  provider = fn;
}

export function cameraRecovery(): CameraRecovery | null {
  try {
    return provider();
  } catch {
    return null;
  }
}

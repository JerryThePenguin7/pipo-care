/** Mobile browsers only expose the camera in a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) (HTTPS or localhost). */
export function isCameraApiAvailable(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function isSecureContextForCamera(): boolean {
  return typeof window === "undefined" || window.isSecureContext;
}

/** Non-null = user cannot get a permission prompt until this is fixed. */
export function cameraPrereqMessage(): string | null {
  if (!isCameraApiAvailable()) {
    return "This browser does not support camera access (no MediaDevices API). Try Chrome or update your browser.";
  }
  if (!isSecureContextForCamera()) {
    return "Camera is blocked because this page is not secure (you are using http:// with a network IP). Open the site with https:// using the “Network” URL from the dev server, or use localhost on this device.";
  }
  return null;
}

export function describeGetUserMediaError(err: unknown): string {
  const e = err as { name?: string; message?: string };
  const name = e?.name || "";
  if (!isSecureContextForCamera()) {
    return cameraPrereqMessage() || "Use HTTPS or localhost for camera access.";
  }
  if (name === "NotAllowedError" || name === "PermissionDismissedError") {
    return "Camera permission was denied or dismissed. Tap the lock icon in the address bar, allow Camera, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found. Check that a camera is available and not in use by another app.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera could not be opened (it may be in use by another app). Close other apps using the camera and try again.";
  }
  if (name === "OverconstrainedError") {
    return "The camera does not support the requested settings. Try again or use another device.";
  }
  if (name === "SecurityError") {
    return "Camera blocked for security reasons. Use https:// (see README) or allow insecure content only if your IT policy permits.";
  }
  return "Could not start the camera. Check permissions, use HTTPS on a phone, and try again.";
}

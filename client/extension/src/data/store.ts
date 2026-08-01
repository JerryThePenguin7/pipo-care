/**
 * Key/value storage for the extension.
 *
 * chrome.storage.local when running as an extension, localStorage otherwise. The fallback
 * is not dead weight: it lets the whole panel run in `npm run dev:ext` in an ordinary tab,
 * which is the only practical way to iterate on the UI without reloading an unpacked
 * extension on every change.
 */

type Json = unknown;

const hasChromeStorage = () =>
  typeof chrome !== "undefined" && !!chrome?.storage?.local;

export async function readKey<T>(key: string, fallback: T): Promise<T> {
  if (hasChromeStorage()) {
    const got = await chrome.storage.local.get(key);
    return (got[key] as T) ?? fallback;
  }
  try {
    const raw = localStorage.getItem(`pipo:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeKey(key: string, value: Json): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  try {
    localStorage.setItem(`pipo:${key}`, JSON.stringify(value));
  } catch {
    /* quota or private mode — nothing we can do from here */
  }
}

export async function removeKey(key: string): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.remove(key);
    return;
  }
  try {
    localStorage.removeItem(`pipo:${key}`);
  } catch {
    /* ignore */
  }
}

/** True when the code is really running inside the packaged extension. */
export function isExtension(): boolean {
  return typeof chrome !== "undefined" && !!chrome?.runtime?.id;
}

/**
 * True when this document is a full tab rather than the side panel.
 *
 * The two surfaces differ in one way that matters: a tab can show a camera permission
 * prompt and the panel cannot. The opener marks tabs with ?surface=tab, which survives the
 * hash router.
 */
export function isTabSurface(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("surface") === "tab";
  } catch {
    return false;
  }
}

/** Resolves a packaged asset (WASM, model, icon) to a chrome-extension:// URL. */
export function assetUrl(relativePath: string): string {
  if (isExtension()) return chrome.runtime.getURL(relativePath);
  return `/${relativePath.replace(/^\//, "")}`;
}

/**
 * Google Identity Services loader.
 *
 * GIS ships as a remote script (like the MediaPipe model, it needs network on first use).
 * It hands back an ID token in the callback; the token is verified server-side before any
 * session is issued — nothing here is trusted on its own.
 */

/**
 * `hl=en` pins the button's wording to English. Without it Google localises the label
 * to the device locale, which reads oddly inside an otherwise English-only UI. Change
 * or drop the parameter when the app itself gets translated.
 */
const SRC = "https://accounts.google.com/gsi/client?hl=en";

export type GoogleCredentialResponse = { credential?: string };

type GoogleAccountsId = {
  initialize: (opts: {
    client_id: string;
    callback: (res: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    opts: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "small" | "medium" | "large";
      text?: "signin_with" | "signup_with" | "continue_with";
      shape?: "rectangular" | "pill";
      width?: number;
      logo_alignment?: "left" | "center";
    }
  ) => void;
  disableAutoSelect: () => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

let pending: Promise<GoogleAccountsId> | null = null;

export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (pending) return pending;

  pending = new Promise<GoogleAccountsId>((resolve, reject) => {
    const done = () => {
      const api = window.google?.accounts?.id;
      if (api) resolve(api);
      else reject(new Error("Google Identity Services loaded but exposed no API"));
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => reject(new Error("Could not load Google sign-in")));
      return;
    }

    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.defer = true;
    script.onload = done;
    script.onerror = () => reject(new Error("Could not load Google sign-in"));
    document.head.appendChild(script);
  }).catch((e) => {
    pending = null; // allow a retry after a network blip
    throw e;
  });

  return pending;
}

/** Stops Google from silently re-authenticating the account we just signed out of. */
export function disableGoogleAutoSelect() {
  try {
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {
    /* GIS not loaded — nothing to disable */
  }
}

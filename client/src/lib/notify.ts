/**
 * OS notifications, pluggable per target.
 *
 * The web app uses the page Notification API. The Chrome extension replaces this with
 * chrome.notifications at startup, because a service-worker-backed extension should not
 * depend on a document staying alive to show or replace an alert.
 *
 * Both implementations honour the same contract: repeated calls with the same id replace
 * the previous notification rather than stacking, and `dismiss()` clears it.
 */

export type DrynessNotifier = {
  show: (title: string, body: string) => void;
  dismiss: () => void;
};

const NOTIF_KEY = "pipo-care-notifications";
const TAG = "pipo-care-dryness";

/** True unless the user turned browser alerts off in Settings. */
export function notificationsEnabled(): boolean {
  try {
    return localStorage.getItem(NOTIF_KEY) === "1";
  } catch {
    return false;
  }
}

let live: Notification | null = null;

const webNotifier: DrynessNotifier = {
  show(title, body) {
    try {
      if (!notificationsEnabled()) return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      live?.close();
      const options = {
        body,
        tag: TAG,
        renotify: true,
        requireInteraction: true,
      } as NotificationOptions;
      const n = new Notification(title, options);
      n.onclick = () => {
        window.focus();
        n.close();
      };
      live = n;
    } catch {
      /* notifications unavailable — the in-app modal and chime still cover it */
    }
  },
  dismiss() {
    try {
      live?.close();
    } catch {
      /* ignore */
    }
    live = null;
  },
};

let current: DrynessNotifier = webNotifier;

export function setDrynessNotifier(notifier: DrynessNotifier) {
  current = notifier;
}

export function showDrynessNotification(title: string, body: string) {
  current.show(title, body);
}

export function dismissDrynessNotification() {
  current.dismiss();
}

/**
 * MV3 service worker.
 *
 * Deliberately thin: it owns the toolbar behaviour and the OS notifications, nothing else.
 * Monitoring itself lives in the panel document, because a service worker has no DOM and
 * therefore no camera — see docs/HANDOFF §5f for why that shapes the whole design.
 */

const NOTIFICATION_ID = "pipo-care-dryness";

type PanelMessage =
  | { type: "dryness-notify"; title: string; body: string }
  | { type: "dryness-clear" }
  | { type: "open-tab" };

chrome.runtime.onInstalled.addListener(() => {
  // Clicking the toolbar icon opens the side panel rather than a popup.
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    /* older Chrome without sidePanel — the action still opens the tab fallback below */
  });
});

chrome.runtime.onMessage.addListener((message: PanelMessage, _sender, sendResponse) => {
  if (message?.type === "dryness-notify") {
    chrome.notifications.create(NOTIFICATION_ID, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: message.title,
      message: message.body,
      priority: 2,
      requireInteraction: true,
    });
  }

  if (message?.type === "dryness-clear") {
    chrome.notifications.clear(NOTIFICATION_ID);
  }

  if (message?.type === "open-tab") {
    chrome.tabs.create({ url: chrome.runtime.getURL("panel.html") });
  }

  sendResponse({ ok: true });
  return false;
});

/** Clicking the alert should take you back to the panel so you can see the blink counter. */
chrome.notifications.onClicked.addListener(async (id) => {
  if (id !== NOTIFICATION_ID) return;
  chrome.notifications.clear(NOTIFICATION_ID);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId != null) await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch {
    chrome.tabs.create({ url: chrome.runtime.getURL("panel.html") });
  }
});

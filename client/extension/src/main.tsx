import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { ProfileProvider } from "./profile";
import { ThemeProvider } from "../../src/context/ThemeContext";
import { setVisionAssets } from "../../src/lib/visionAssets";
import { setDrynessNotifier } from "../../src/lib/notify";
import { setCameraRecoveryProvider } from "../../src/lib/cameraRecovery";
import { assetUrl, isExtension, isTabSurface } from "./data/store";
import "./extension.css";

/**
 * MV3 forbids running remotely-hosted code, so the MediaPipe runtime and the face model
 * are shipped inside the package instead of fetched from Google's CDN. This also means
 * the extension works with no internet connection at all.
 */
setVisionAssets({
  wasmBase: assetUrl("vision"),
  modelUrl: assetUrl("models/face_landmarker.task"),
});

/**
 * Dryness alerts go through the service worker. A page Notification would die with the
 * panel document; chrome.notifications outlives it and can be re-fired and cleared by id.
 */
if (isExtension()) {
  setDrynessNotifier({
    show(title, body) {
      try {
        if (localStorage.getItem("pipo-care-notifications") !== "1") return;
        void chrome.runtime.sendMessage({ type: "dryness-notify", title, body });
      } catch {
        /* worker asleep or reloading — the in-panel modal still shows the countdown */
      }
    },
    dismiss() {
      try {
        void chrome.runtime.sendMessage({ type: "dryness-clear" });
      } catch {
        /* ignore */
      }
    },
  });
}

/**
 * Chrome refuses to render a permission prompt inside a side panel, so getUserMedia there
 * fails with NotAllowedError and the user never sees a bubble. Permission is stored per
 * extension origin, so granting once in a normal tab makes the panel work from then on.
 * In a tab we offer nothing — the prompt appears there by itself.
 */
if (isExtension()) {
  setCameraRecoveryProvider(() =>
    isTabSurface()
      ? null
      : {
          title: "Chrome can’t ask for the camera in the side panel",
          detail:
            "That is a Chrome restriction, not a problem with your setup. Open Pipo Care in a tab, press Start capture there and choose Allow — once granted, the side panel can use the camera too.",
          actionLabel: "Grant camera access in a tab",
          run: () => {
            void chrome.runtime.sendMessage({ type: "open-tab", route: "#/monitor" });
          },
        }
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <ThemeProvider>
        <ProfileProvider>
          <App />
        </ProfileProvider>
      </ThemeProvider>
    </HashRouter>
  </React.StrictMode>
);

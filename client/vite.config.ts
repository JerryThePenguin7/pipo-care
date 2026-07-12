import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

/**
 * HTTPS in dev so mobile Chrome allows the camera on LAN URLs
 * (http://192.168.x.x is not a "secure context" — getUserMedia is blocked).
 */
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true, // listen on 0.0.0.0 — use https://<this-pc-lan-ip>:5173 on phones
    port: 5173,
    strictPort: true,
    https: true,
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
});

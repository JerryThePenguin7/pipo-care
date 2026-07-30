import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

/**
 * Hostnames the dev server will answer to, beyond localhost and raw IPs.
 *
 * Why this list exists: Google refuses a bare IP address as an authorised JavaScript
 * origin ("must end with a public top-level domain"), so phone testing *with Google
 * sign-in* has to arrive over a real hostname — a tunnel, or wildcard DNS that maps a
 * name onto the LAN IP (see README → "Testing on a phone").
 *
 * Note this is currently inert: Vite only installs its Host-header check when
 * `server.https` is unset, and we always enable HTTPS below. It matters the moment
 * someone drops basic-ssl — which is the natural thing to do behind a tunnel, since
 * the tunnel already terminates TLS — and it documents the hostnames that are expected.
 *
 * Add your own with PIPO_ALLOWED_HOSTS=my.example.com,other.example.com
 */
const TUNNEL_HOSTS = [
  ".trycloudflare.com", // cloudflared tunnel --url ...
  ".ngrok-free.app",
  ".ngrok.app",
  ".loca.lt", // localtunnel
  ".nip.io", // 192-168-1-5.nip.io -> 192.168.1.5
  ".sslip.io",
];

const extraHosts = (process.env.PIPO_ALLOWED_HOSTS || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

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
    allowedHosts: [...TUNNEL_HOSTS, ...extraHosts],
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
});

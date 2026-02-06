import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0", // Allow access from other devices on network
    port: 3000,
    allowedHosts: [
      ".ngrok-free.app", // Allow all ngrok free tier domains
      ".ngrok.io",       // Allow all ngrok domains
      ".railway.app",    // Allow Railway domains
    ],
    proxy: {
      "/ws": {
        target: process.env.VITE_API_URL || "ws://localhost:8000",
        ws: true,
        changeOrigin: true,
      },
      "/call": {
        target: process.env.VITE_API_URL || "ws://localhost:8000",
        ws: true,
        changeOrigin: true,
      },
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: parseInt(process.env.PORT || "3000"),
  },
});

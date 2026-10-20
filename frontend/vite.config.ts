import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (
            id.includes("node_modules/gsap") ||
            id.includes("node_modules/@gsap")
          )
            return "gsap";
          if (
            id.includes("node_modules/motion") ||
            id.includes("node_modules/framer-motion")
          )
            return "motion";
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    // в docker-режиме разработки API доступен по имени сервиса
    proxy: { "/api": { target: process.env.API_PROXY || "http://127.0.0.1:8000", changeOrigin: true } },
  },
});

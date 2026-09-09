import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Standalone Vite app, structurally matching eva-graph/apps/kgdj's own
// vite.config.ts -- OPENLPM_BASE lets the GitHub Pages workflow build with
// the repo-name subpath (/openlpm/) while local dev stays at "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.OPENLPM_BASE || "/",
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5173, strictPort: false },
  build: { outDir: "dist", sourcemap: false, target: "es2020" },
});

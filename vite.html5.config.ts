// Standalone static HTML5 build (no TanStack Start server / Nitro).
// Output: dist-html5/ with index.html at the root and only relative asset paths,
// so it runs from a ZIP upload (CrazyGames) or any static file host.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r("./html5"),
  base: "./",
  publicDir: r("./html5/public"),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": r("./src") } },
  build: {
    outDir: r("./dist-html5"),
    emptyOutDir: true,
    assetsDir: "assets",
    assetsInlineLimit: 0,
    sourcemap: false,
    target: "es2020",
  },
});

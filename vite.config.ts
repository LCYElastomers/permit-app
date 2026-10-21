import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Tauri looks for the dev server on port 3000 and the production bundle in /build.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 3000,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
});

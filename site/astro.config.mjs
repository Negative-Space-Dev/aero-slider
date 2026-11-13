// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

// The page reads its size figures from the built library, which a fresh checkout doesn't have.
if (!existsSync(resolve(root, "dist/aero-slider.min.js"))) {
  execSync("bun run build", { cwd: root, stdio: "inherit" });
}

export default defineConfig({
  site: "https://aeroslider.com",
  output: "static",
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "aero-slider/slider.css": resolve(root, "src/slider.css"),
        "aero-slider": resolve(root, "src/index.ts"),
      },
    },
    server: {
      allowedHosts: ["localhost", ".ngrok-free.app"],
    },
  },
});

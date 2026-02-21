// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

export default defineConfig({
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

import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "aero-slider": "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  minify: true,
  external: [],
  esbuildOptions(options) {
    options.banner = { js: "" };
  },
  async onSuccess() {
    const { cpSync } = await import("node:fs");
    cpSync("src/slider.css", "dist/aero-slider.css");
  },
});

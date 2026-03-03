import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "aero-slider": "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  minify: true,
  outExtension() {
    return { js: ".min.js" };
  },
  external: [],
  esbuildOptions(options) {
    options.banner = { js: "" };
  },
  async onSuccess() {
    const esbuild = await import("esbuild");
    await esbuild.default.build({
      entryPoints: ["src/slider.css"],
      outfile: "dist/aero-slider.min.css",
      minify: true,
    });
  },
});

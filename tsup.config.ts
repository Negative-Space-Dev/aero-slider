import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
  repository?: { url?: string };
};

const repoUrl = pkg.repository?.url?.replace(/\.git$/, "") ?? "";
const buildBanner = `/*! Aero Slider v${pkg.version} | ${repoUrl} */`;

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
    options.banner = { js: buildBanner };
  },
  async onSuccess() {
    const esbuild = await import("esbuild");
    await esbuild.default.build({
      entryPoints: ["src/slider.css"],
      outfile: "dist/aero-slider.min.css",
      minify: true,
      banner: { css: buildBanner },
    });
  },
});

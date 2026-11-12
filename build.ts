import { generateDtsBundle } from "dts-bundle-generator";
import pkg from "./package.json";

const repo = pkg.repository.url.replace(/^git\+|\.git$/g, "");
const banner = `/*! Aero Slider v${pkg.version} | ${repo} */`;

await Bun.$`rm -rf dist`;

const results = await Promise.all([
  Bun.build({
    entrypoints: ["src/index.ts"],
    outdir: "dist",
    naming: "index.js",
    sourcemap: "linked",
    banner,
  }),
  Bun.build({
    entrypoints: ["src/global.ts"],
    outdir: "dist",
    naming: "aero-slider.min.js",
    minify: true,
    banner,
  }),
  Bun.build({ entrypoints: ["src/slider.css"], minify: true }),
]);
const failed = results.filter((result) => !result.success);
if (failed.length) {
  console.error(...failed.flatMap((result) => result.logs));
  process.exit(1);
}
const css = results[2]!;
await Bun.write("dist/aero-slider.min.css", `${banner}\n${await css.outputs[0]!.text()}`);

const [dts] = generateDtsBundle(
  [
    {
      filePath: "src/index.ts",
      output: { inlineDeclareGlobals: true, noBanner: true, exportReferencedTypes: false },
    },
  ],
  { preferredConfigPath: "tsconfig.json" }
);
await Bun.write("dist/index.d.ts", `${banner}\n${dts}`);

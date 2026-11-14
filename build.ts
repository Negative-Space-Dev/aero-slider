import { generateDtsBundle } from "dts-bundle-generator";
import pkg from "./package.json";

const repo = pkg.repository.url.replace(/^git\+|\.git$/g, "");
const banner = `/*! Aero Slider v${pkg.version} | ${repo} */`;

await Bun.$`rm -rf dist`;

// Direct-load files: the full file, the core, and one file per extension. Extension files are
// wrapped so any of them can be concatenated after the core without their names colliding.
const direct = [
  ["src/global.ts", "aero-slider.min.js", "esm"],
  ["src/direct/core.ts", "aero-slider.core.min.js", "esm"],
  ...["loop", "autoplay", "dots", "thumbnails"].map(
    (name) => [`src/direct/${name}.ts`, `extensions/${name}.min.js`, "iife"] as const
  ),
] as const;
const styles = [
  ["src/full.css", "aero-slider.min.css"],
  ["src/slider.css", "aero-slider.core.min.css"],
  ["src/extensions/loop.css", "extensions/loop.min.css"],
  ["src/extensions/dots.css", "extensions/dots.min.css"],
] as const;

const results = await Promise.all([
  Bun.build({
    entrypoints: ["src/index.ts"],
    outdir: "dist",
    naming: "index.js",
    sourcemap: "linked",
    banner,
  }),
  ...direct.map(([entry, naming, format]) =>
    Bun.build({ entrypoints: [entry], outdir: "dist", naming, minify: true, format, banner })
  ),
  ...styles.map(([entry]) => Bun.build({ entrypoints: [entry], minify: true })),
]);
const failed = results.filter((result) => !result.success);
if (failed.length) {
  console.error(...failed.flatMap((result) => result.logs));
  process.exit(1);
}
const cssResults = results.slice(1 + direct.length);
for (const [i, [, naming]] of styles.entries()) {
  await Bun.write(`dist/${naming}`, `${banner}\n${await cssResults[i]!.outputs[0]!.text()}`);
}

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

// bun 1.3.14 applies this package's own "sideEffects" field to the build and writes an entry with
// no code in it. Fail here rather than publish that.
const entry = await import(`${import.meta.dir}/dist/index.js`);
if (typeof entry.createSlider !== "function" || typeof entry.syncThumbnails !== "function") {
  console.error("dist/index.js does not export createSlider and syncThumbnails");
  process.exit(1);
}

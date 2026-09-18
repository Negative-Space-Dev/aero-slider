import pkg from "./package.json";

const repo = pkg.repository.url.replace(/^git\+|\.git$/g, "");
const banner = `/*! Aero Slider v${pkg.version} | ${repo} */`;

await Bun.$`rm -rf dist`;

const js = await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  naming: "aero-slider.min.js",
  minify: true,
  banner,
});
const css = await Bun.build({ entrypoints: ["src/slider.css"], minify: true });
if (!js.success || !css.success) {
  console.error(...js.logs, ...css.logs);
  process.exit(1);
}
await Bun.write("dist/aero-slider.min.css", `${banner}\n${await css.outputs[0]!.text()}`);

// Type declarations, with import paths rewritten from .ts to .js for consumers
await Bun.$`tsc -p . --noEmit false --declaration --emitDeclarationOnly --outDir dist`;
for (const path of new Bun.Glob("dist/*.d.ts").scanSync()) {
  const source = await Bun.file(path).text();
  await Bun.write(path, source.replaceAll('.ts";', '.js";'));
}

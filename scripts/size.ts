const JS_BUDGET = 9_000;
const CSS_BUDGET = 1_500;

const report = (path: string, bytes: Uint8Array<ArrayBuffer>, note: string) =>
  console.log(`${path}  ${bytes.length} B raw  ${Bun.gzipSync(bytes).length} B gzip  ${note}`);

let over = false;
for (const [path, budget] of [
  ["dist/aero-slider.min.js", JS_BUDGET],
  ["dist/aero-slider.min.css", CSS_BUDGET],
] as const) {
  const bytes = await Bun.file(path).bytes();
  const gzipped = Bun.gzipSync(bytes).length;
  report(path, bytes, `(budget ${budget})  ${gzipped > budget ? "OVER BUDGET" : "ok"}`);
  over ||= gzipped > budget;
}

const minified = await Bun.build({ entrypoints: ["dist/index.js"], minify: true });
if (!minified.success) {
  console.error(...minified.logs);
  process.exit(1);
}
report(
  "dist/index.js",
  new Uint8Array(await minified.outputs[0]!.arrayBuffer()),
  "(minified here, no budget)"
);

if (over) process.exit(1);

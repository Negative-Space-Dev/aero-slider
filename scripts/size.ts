const JS_BUDGET = 8_500;
const CSS_BUDGET = 1_500;

let over = false;
for (const [path, budget] of [
  ["dist/aero-slider.min.js", JS_BUDGET],
  ["dist/aero-slider.min.css", CSS_BUDGET],
] as const) {
  const bytes = await Bun.file(path).bytes();
  const gzipped = Bun.gzipSync(bytes).length;
  const status = gzipped > budget ? "OVER BUDGET" : "ok";
  console.log(`${path}  ${bytes.length} B raw  ${gzipped} B gzip  (budget ${budget})  ${status}`);
  over ||= gzipped > budget;
}
if (over) process.exit(1);

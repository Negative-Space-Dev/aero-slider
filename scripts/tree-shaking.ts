import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SYNC_MARKER = "aero-slider__thumb--active";

const target = resolve(Bun.argv[2] ?? "dist/index.js");
const dir = await mkdtemp(join(tmpdir(), "aero-tree-shaking-"));
try {
  const entry = join(dir, "entry.js");
  await Bun.write(
    entry,
    `import { createSlider } from ${JSON.stringify(target)};\nconsole.log(createSlider);\n`
  );
  const result = await Bun.build({ entrypoints: [entry], minify: true });
  if (!result.success) {
    console.error(...result.logs);
    process.exit(1);
  }
  const code = await result.outputs[0]!.text();
  console.log(JSON.stringify({ bytes: code.length, keepsSync: code.includes(SYNC_MARKER) }));
} finally {
  await rm(dir, { recursive: true, force: true });
}

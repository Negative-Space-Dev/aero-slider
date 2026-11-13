import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = await mkdtemp(join(tmpdir(), "aero-pack-"));
try {
  await Bun.$`bun pm pack --destination ${dir} --quiet`;
  const [tarball] = await Array.fromAsync(new Bun.Glob("*.tgz").scan({ cwd: dir, absolute: true }));
  if (!tarball) throw new Error(`bun pm pack wrote no tarball to ${dir}`);
  await Bun.$`publint run ${tarball} --strict`;
  // ESM-only by design, and attw cannot resolve a CSS file as a module.
  await Bun.$`attw ${tarball} --ignore-rules cjs-resolves-to-esm --exclude-entrypoints ./slider.css`;
} finally {
  await rm(dir, { recursive: true, force: true });
}

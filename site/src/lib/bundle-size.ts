import { gzipSync } from "node:zlib";
import fullJs from "../../../dist/aero-slider.min.js?raw";
import fullCss from "../../../dist/aero-slider.min.css?raw";
import coreJs from "../../../dist/aero-slider.core.min.js?raw";
import coreCss from "../../../dist/aero-slider.core.min.css?raw";

const gzipKB = (source: string) => gzipSync(source).length / 1000;

const sizes = (js: string, css: string) => {
  const size = { js: gzipKB(js), css: gzipKB(css) };
  return { ...size, total: size.js + size.css };
};

/** Gzipped size of the built library files, in KB: the core alone, and with every extension. */
export const bundleSize = {
  core: sizes(coreJs, coreCss),
  full: sizes(fullJs, fullCss),
};

const extensionFiles = import.meta.glob("../../../dist/extensions/*.min.{js,css}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Gzipped size of one extension's files in `dist/extensions/`, JavaScript and CSS together, in KB. */
export const extensionSize = (file: string) =>
  Object.entries(extensionFiles)
    .filter(([path]) => path.includes(`/extensions/${file}.min.`))
    .reduce((sum, [, source]) => sum + gzipKB(source), 0);

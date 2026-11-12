import { gzipSync } from "node:zlib";
import js from "../../../dist/aero-slider.min.js?raw";
import css from "../../../dist/aero-slider.min.css?raw";

const gzipKB = (source: string) => gzipSync(source).length / 1000;

/** Gzipped size of the built library files, in KB. */
export const bundleSize = {
  js: gzipKB(js),
  css: gzipKB(css),
  get total() {
    return this.js + this.css;
  },
};

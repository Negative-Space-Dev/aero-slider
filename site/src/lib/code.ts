/** Languages the docs highlight. Each must be a bundled Shiki language. */
export type CodeLang = "html" | "css" | "typescript" | "javascript" | "bash";

export interface CodeTab {
  label: string;
  code: string;
  lang: CodeLang;
  /** Stable key for the tab; tabs in the same group switch together by key. Defaults to the label. */
  key?: string;
}

export function tabKey(tab: CodeTab): string {
  return tab.key ?? tab.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Options that only work with an extension loaded, and the extension each needs. */
interface ExtensionNeeds {
  loop?: boolean;
  autoplay?: boolean | "continuous";
  maxDots?: number;
}

/**
 * The extensions a sample's sliders need, in the order `use()` lists them. `thumbnails` is a strip
 * synced with `syncThumbnails`, which loops it unless told not to.
 */
export function extensionsFor(configs: ExtensionNeeds[], loopedStrip = false): string[] {
  const any = (test: (config: ExtensionNeeds) => boolean) => configs.some(test);
  return [
    (loopedStrip || any((config) => !!config.loop || !!config.autoplay)) && "loop",
    any((config) => !!config.autoplay) && "autoplay",
    any((config) => (config.maxDots ?? 0) > 0) && "maxDots",
  ].filter((name): name is string => !!name);
}

/** A sample's import line, and its `use()` call when it needs extensions. */
export function importLines(names: string[], extensions: string[]): string[] {
  const imported = ["createSlider", ...(extensions.length ? ["use", ...extensions] : []), ...names];
  const lines = [`import { ${imported.join(", ")} } from "aero-slider";`, ``];
  if (extensions.length) lines.push(`use({ ${extensions.join(", ")} });`, ``);
  return lines;
}

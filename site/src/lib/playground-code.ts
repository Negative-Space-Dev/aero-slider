import type { SliderAlignment } from "aero-slider";
import { extensionsFor, importLines } from "./code";

export type PlaygroundDirection = "ltr" | "rtl" | "ttb";

export interface PlaygroundSettings {
  slideCount: number;
  slidesPerView: number;
  gap: number;
  perMove: number;
  /** Undefined when the control is at its "unlimited" end. */
  maxDots: number | undefined;
  autoplayInterval: number;
  alignment: SliderAlignment;
  /** The playground's layout picker: rtl is a dir attribute, ttb the vertical option. */
  direction: PlaygroundDirection;
  loop: boolean;
  pagination: boolean;
  navigation: boolean;
  draggable: boolean;
  autoplay: boolean;
  thumbnails: boolean;
}

export interface PlaygroundCode {
  html: string;
  css: string;
  js: string;
}

const LIBRARY_DEFAULTS = {
  alignment: "center",
  perMove: 1,
  autoplayInterval: 5000,
} as const;

const THUMBS_PER_VIEW = 5;
const SHOWN_SLIDES = 2;

function slideLines(count: number, indent: string, slide: (n: number) => string): string[] {
  const shown = Array.from({ length: Math.min(count, SHOWN_SLIDES) }, (_, i) => i + 1);
  const lines = shown.map((n) => indent + slide(n));
  if (count > shown.length) lines.push(`${indent}<!-- … ${count} slides in total -->`);
  return lines;
}

function html(s: PlaygroundSettings): string {
  const lines = [
    `<div id="slider" class="aero-slider"${s.direction === "rtl" ? ` dir="rtl"` : ""} role="region" aria-roledescription="carousel" aria-label="Featured">`,
    `  <div class="aero-slider__viewport">`,
    ...(s.navigation
      ? [
          `    <button type="button" class="aero-slider__nav--prev" aria-label="Previous slide">‹</button>`,
          `    <button type="button" class="aero-slider__nav--next" aria-label="Next slide">›</button>`,
        ]
      : []),
    `    <div class="aero-slider__track">`,
    ...slideLines(
      s.slideCount,
      "      ",
      (n) =>
        `<div role="group" aria-roledescription="slide" aria-label="${n} of ${s.slideCount}">Slide ${n}</div>`
    ),
    `    </div>`,
    `  </div>`,
    ...(s.pagination
      ? [
          `  <div class="aero-slider__pagination" role="group" aria-label="Slides">`,
          `    <button type="button" class="aero-slider__dot" aria-label="Go to slide {index}"></button>`,
          `  </div>`,
        ]
      : []),
    `</div>`,
  ];
  if (s.thumbnails) {
    lines.push(
      ``,
      `<div id="thumbs" class="aero-slider" role="group" aria-label="Thumbnails">`,
      `  <div class="aero-slider__viewport">`,
      `    <div class="aero-slider__track">`,
      ...slideLines(
        s.slideCount,
        "      ",
        (n) => `<button type="button" aria-label="Show slide ${n}">${n}</button>`
      ),
      `    </div>`,
      `  </div>`,
      `</div>`
    );
  }
  return lines.join("\n");
}

function css(s: PlaygroundSettings): string {
  const rules = [
    `#slider {
  --aero-slides-per-view: ${s.slidesPerView};
  --aero-slide-gap: ${s.gap}px;
}`,
  ];
  if (s.thumbnails) {
    rules.push(`#thumbs {
  --aero-slides-per-view: ${THUMBS_PER_VIEW};
  --aero-slide-gap: 8px;
  --aero-slide-aspect: 16 / 9;
}`);
  }
  return rules.join("\n\n");
}

function objectLiteral(entries: [string, string][]): string {
  if (entries.length === 0) return "";
  return `, {\n${entries.map(([key, value]) => `  ${key}: ${value},`).join("\n")}\n}`;
}

/** Options that differ from the library defaults, as source text. */
function sliderOptions(s: PlaygroundSettings): [string, string][] {
  const entries: [string, string][] = [];
  if (s.loop) entries.push(["loop", "true"]);
  if (s.alignment !== LIBRARY_DEFAULTS.alignment) entries.push(["alignment", `"${s.alignment}"`]);
  if (s.direction === "ttb") entries.push(["vertical", "true"]);
  if (s.perMove !== LIBRARY_DEFAULTS.perMove) entries.push(["perMove", String(s.perMove)]);
  if (!s.draggable) entries.push(["draggable", "false"]);
  if (s.autoplay) {
    entries.push(["autoplay", "true"]);
    if (s.autoplayInterval !== LIBRARY_DEFAULTS.autoplayInterval) {
      entries.push(["autoplayInterval", String(s.autoplayInterval)]);
    }
  }
  if (s.pagination && s.maxDots !== undefined) entries.push(["maxDots", String(s.maxDots)]);
  return entries;
}

function js(s: PlaygroundSettings): string {
  const extensions = extensionsFor(
    [{ loop: s.loop, autoplay: s.autoplay, maxDots: s.pagination ? s.maxDots : 0 }],
    s.thumbnails && s.loop
  );
  const lines = [
    ...importLines(s.thumbnails ? ["syncThumbnails"] : [], extensions),
    `const slider = createSlider(document.getElementById("slider")${objectLiteral(sliderOptions(s))});`,
  ];
  if (s.thumbnails) {
    const thumbOptions: [string, string][] = [["alignment", `"center"`]];
    if (s.loop) thumbOptions.push(["loop", "true"]);
    lines.push(
      `const thumbs = createSlider(document.getElementById("thumbs")${objectLiteral(thumbOptions)});`,
      `syncThumbnails(slider, thumbs${s.loop ? "" : ", { loop: false }"});`
    );
  }
  return lines.join("\n");
}

/** The code a visitor would write for the current playground settings, per layer. */
export function playgroundCode(settings: PlaygroundSettings): PlaygroundCode {
  return { html: html(settings), css: css(settings), js: js(settings) };
}

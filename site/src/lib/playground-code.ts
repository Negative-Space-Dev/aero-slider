import type { SliderAlignment, SliderConfig } from "aero-slider";

export interface PlaygroundSettings {
  slideCount: number;
  slidesPerView: number;
  gap: number;
  perMove: number;
  /** Undefined when the control is at its "unlimited" end. */
  maxDots: number | undefined;
  autoplayInterval: number;
  alignment: SliderAlignment;
  direction: NonNullable<SliderConfig["direction"]>;
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
  direction: "ltr",
  perMove: 1,
  autoplayInterval: 5000,
} as const;

const THUMBS_PER_VIEW = 5;
const SHOWN_SLIDES = 2;

function slideLines(count: number, indent: string, text: (n: number) => string): string[] {
  const shown = Array.from({ length: Math.min(count, SHOWN_SLIDES) }, (_, i) => i + 1);
  const lines = shown.map((n) => `${indent}<div>${text(n)}</div>`);
  if (count > shown.length) lines.push(`${indent}<!-- … ${count} slides in total -->`);
  return lines;
}

function html(s: PlaygroundSettings): string {
  const lines = [
    `<div id="slider" class="aero-slider">`,
    `  <div class="aero-slider__viewport">`,
    ...(s.navigation
      ? [
          `    <button type="button" class="aero-slider__nav--prev" aria-label="Previous slide">‹</button>`,
          `    <button type="button" class="aero-slider__nav--next" aria-label="Next slide">›</button>`,
        ]
      : []),
    `    <div class="aero-slider__track">`,
    ...slideLines(s.slideCount, "      ", (n) => `Slide ${n}`),
    `    </div>`,
    `  </div>`,
    ...(s.pagination
      ? [
          `  <div class="aero-slider__pagination">`,
          `    <span class="aero-slider__dot"></span>`,
          `  </div>`,
        ]
      : []),
    `</div>`,
  ];
  if (s.thumbnails) {
    lines.push(
      ``,
      `<div id="thumbs" class="aero-slider">`,
      `  <div class="aero-slider__viewport">`,
      `    <div class="aero-slider__track">`,
      ...slideLines(s.slideCount, "      ", String),
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
  --slides-per-view: ${s.slidesPerView};
  --slide-gap: ${s.gap}px;
}`,
  ];
  if (s.thumbnails) {
    rules.push(`#thumbs {
  --slides-per-view: ${THUMBS_PER_VIEW};
  --slide-gap: 8px;
  --slide-aspect: 16 / 9;
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
  if (s.direction !== LIBRARY_DEFAULTS.direction) entries.push(["direction", `"${s.direction}"`]);
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
  const imports = s.thumbnails ? "createSlider, syncThumbnails" : "createSlider";
  const lines = [
    `import { ${imports} } from "aero-slider";`,
    ``,
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

// One definition of a demo slide, shared by the Astro markup and the client
// script that adds slides at runtime, so both always render the same plate.

export const TONE_COUNT = 5;

export interface SlideContent {
  /** Large numeral, letter or word. */
  num: string | number;
  /** 1-based tone; defaults to cycling through the tones by position. */
  tone?: number;
  /** Small mono caption shown in the top corner. */
  label?: string;
  /** Supporting sentence under the numeral. */
  text?: string;
}

/** Tone for the nth slide (1-based), cycling through the palette. */
export function toneFor(position: number): number {
  return ((position - 1) % TONE_COUNT) + 1;
}

// The playground opens on the accent, then runs through the rest of the palette.
const HERO_TONES = [3, 1, 2, 4, 5];

/** Tone for the nth playground slide (1-based); its thumbnail uses the same. */
export function heroToneFor(position: number): number {
  return HERO_TONES[(position - 1) % HERO_TONES.length];
}

/** Zero-pads numbers to two digits; leaves letters and words alone. */
export function formatNum(num: string | number): string {
  return typeof num === "number" ? String(num).padStart(2, "0") : num;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function slideInnerHtml({ num, label, text }: SlideContent): string {
  const parts = [
    label ? `<span class="slide__label">${escapeHtml(label)}</span>` : "",
    `<span class="slide__num">${escapeHtml(formatNum(num))}</span>`,
    text ? `<p class="slide__text">${escapeHtml(text)}</p>` : "",
  ];
  return `<div class="slide__body">${parts.join("")}</div>`;
}

export function createSlideElement(content: SlideContent, position: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "slide";
  el.dataset.tone = String(content.tone ?? toneFor(position));
  el.innerHTML = slideInnerHtml(content);
  return el;
}

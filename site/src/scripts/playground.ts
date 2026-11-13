import { createSlider, syncThumbnails } from "aero-slider";
import type { SliderConfig, SliderInstance } from "aero-slider";
import { getRequiredElementById } from "../lib/dom";
import { highlight, type LiveLang } from "../lib/highlight";
import {
  playgroundCode,
  type PlaygroundDirection,
  type PlaygroundSettings,
} from "../lib/playground-code";
import { createSlideElement, heroToneFor, nameSlides } from "../lib/slide";

// Discrete steps for slidesPerView with exponential curve
const SPV_STEPS = [1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.75, 2, 2.5, 3, 4, 5];

function spvIndexToValue(index: number): number {
  return SPV_STEPS[Math.max(0, Math.min(SPV_STEPS.length - 1, index))];
}

function spvValueToIndex(value: number): number {
  let closest = 0;
  let minDiff = Math.abs(SPV_STEPS[0] - value);
  for (let i = 1; i < SPV_STEPS.length; i++) {
    const diff = Math.abs(SPV_STEPS[i] - value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = i;
    }
  }
  return closest;
}

function formatOutputValue(name: string, value: string): string {
  if (name === "slidesPerView") {
    const idx = Number(value);
    if (Number.isNaN(idx)) return value;
    const spv = spvIndexToValue(idx);
    return spv.toFixed(2).replace(/\.?0+$/, "");
  }
  if (name === "slideCount") {
    const n = Number(value);
    if (Number.isNaN(n)) return value;
    return String(Math.min(20, Math.max(3, Math.round(n))));
  }
  if (name === "gap") {
    return `${value}px`;
  }
  if (name === "autoplayInterval") {
    return `${value}ms`;
  }
  if (name === "maxDots") {
    const n = Number(value);
    if (n >= 21) return "∞";
    return String(n);
  }
  return value;
}

// ── Hero interactive slider ───────────────────────────────────────────
const form = getRequiredElementById<HTMLFormElement>("config-form");
const heroSliderEl = getRequiredElementById<HTMLElement>("hero-slider");
const heroThumbsWrapper = getRequiredElementById<HTMLElement>("hero-thumbs-wrapper");

const outputs: Record<string, HTMLOutputElement> = {
  slidesPerView: getRequiredElementById<HTMLOutputElement>("out-spv"),
  gap: getRequiredElementById<HTMLOutputElement>("out-gap"),
  autoplayInterval: getRequiredElementById<HTMLOutputElement>("out-interval"),
  slideCount: getRequiredElementById<HTMLOutputElement>("out-slideCount"),
  maxDots: getRequiredElementById<HTMLOutputElement>("out-maxDots"),
  perMove: getRequiredElementById<HTMLOutputElement>("out-perMove"),
};

// ── URL params ↔ form sync ────────────────────────────────────────────
const PARAM_KEYS = {
  slideCount: "sc",
  slidesPerView: "spv",
  gap: "gap",
  autoplayInterval: "interval",
  maxDots: "dots",
  alignment: "align",
  direction: "dir",
  perMove: "pm",
  loop: "loop",
  pagination: "pag",
  navigation: "nav",
  draggable: "drag",
  autoplay: "auto",
  thumbnails: "thumbs",
} as const;

function applyParamsFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const setRange = (name: string, min: number, max: number) => {
    const val = params.get(PARAM_KEYS[name as keyof typeof PARAM_KEYS]);
    if (val == null) return;
    const n = Number(val);
    if (!Number.isNaN(n)) {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el) el.value = String(Math.max(min, Math.min(max, Math.round(n))));
    }
  };
  const setCheckbox = (name: string) => {
    const val = params.get(PARAM_KEYS[name as keyof typeof PARAM_KEYS]);
    if (val == null) return;
    const el = form.elements.namedItem(name) as HTMLInputElement | null;
    if (el) el.checked = val === "1" || val === "on" || val === "true";
  };
  const setSelect = (name: string, valid: string[]) => {
    const val = params.get(PARAM_KEYS[name as keyof typeof PARAM_KEYS]);
    if (val == null || !valid.includes(val)) return;
    const el = form.elements.namedItem(name) as RadioNodeList | null;
    if (el) el.value = val;
  };

  setRange("slideCount", 3, 20);
  setRange("slidesPerView", 0, 16);
  setRange("gap", 0, 32);
  setRange("autoplayInterval", 1000, 8000);
  setRange("maxDots", 3, 21);
  setRange("perMove", 1, 4);
  setSelect("alignment", ["start", "center", "end"]);
  setSelect("direction", ["ltr", "rtl", "ttb"]);
  setCheckbox("loop");
  setCheckbox("pagination");
  setCheckbox("navigation");
  setCheckbox("draggable");
  setCheckbox("autoplay");
  setCheckbox("thumbnails");
}

const DEFAULTS = {
  slideCount: "5",
  slidesPerView: "0",
  gap: "10",
  autoplayInterval: "4000",
  maxDots: "9",
  alignment: "center",
  direction: "ltr",
  perMove: "1",
  loop: false,
  pagination: true,
  navigation: true,
  draggable: true,
  autoplay: false,
  thumbnails: false,
};

function syncUrlFromForm(): void {
  const fd = new FormData(form);
  const params = new URLSearchParams();

  const setIfNotDefault = (key: string, formName: string) => {
    const val = fd.get(formName) ?? "";
    if (val !== DEFAULTS[formName as keyof typeof DEFAULTS]) params.set(key, String(val));
  };
  const setCheckboxIfNotDefault = (formName: string, paramKey: string) => {
    const checked = fd.get(formName) === "on";
    const def = DEFAULTS[formName as keyof typeof DEFAULTS] as boolean;
    if (checked !== def) params.set(paramKey, checked ? "1" : "0");
  };

  setIfNotDefault(PARAM_KEYS.slideCount, "slideCount");
  setIfNotDefault(PARAM_KEYS.slidesPerView, "slidesPerView");
  setIfNotDefault(PARAM_KEYS.gap, "gap");
  setIfNotDefault(PARAM_KEYS.autoplayInterval, "autoplayInterval");
  setIfNotDefault(PARAM_KEYS.maxDots, "maxDots");
  setIfNotDefault(PARAM_KEYS.alignment, "alignment");
  setIfNotDefault(PARAM_KEYS.direction, "direction");
  setIfNotDefault(PARAM_KEYS.perMove, "perMove");
  setCheckboxIfNotDefault("loop", PARAM_KEYS.loop);
  setCheckboxIfNotDefault("pagination", PARAM_KEYS.pagination);
  setCheckboxIfNotDefault("navigation", PARAM_KEYS.navigation);
  setCheckboxIfNotDefault("draggable", PARAM_KEYS.draggable);
  setCheckboxIfNotDefault("autoplay", PARAM_KEYS.autoplay);
  setCheckboxIfNotDefault("thumbnails", PARAM_KEYS.thumbnails);

  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, "", url);
}

const ORDINALS = ["One", "Two", "Three", "Four", "Five"] as const;

function createHeroSlide(n: number): HTMLElement {
  const label = n <= 5 ? ORDINALS[n - 1] : String(n);
  return createSlideElement({ num: n, label: `Slide ${label}`, tone: heroToneFor(n) }, n);
}

function createThumbSlide(n: number): HTMLElement {
  return createSlideElement({ num: n, tone: heroToneFor(n) }, n, true);
}

function reconcileSlideCount(targetCount: number): void {
  const heroTrack = heroSliderEl.querySelector<HTMLElement>(".aero-slider__track");
  const thumbsEl = document.getElementById("hero-thumbs");
  const thumbsTrack = thumbsEl?.querySelector<HTMLElement>(".aero-slider__track");
  if (!heroTrack) return;

  const currentHero = heroTrack.children.length;
  if (currentHero < targetCount) {
    for (let i = currentHero + 1; i <= targetCount; i++) {
      heroTrack.appendChild(createHeroSlide(i));
    }
  } else if (currentHero > targetCount) {
    while (heroTrack.children.length > targetCount) {
      heroTrack.lastElementChild?.remove();
    }
  }

  if (thumbsTrack) {
    const currentThumbs = thumbsTrack.children.length;
    if (currentThumbs < targetCount) {
      for (let i = currentThumbs + 1; i <= targetCount; i++) {
        thumbsTrack.appendChild(createThumbSlide(i));
      }
    } else if (currentThumbs > targetCount) {
      while (thumbsTrack.children.length > targetCount) {
        thumbsTrack.lastElementChild?.remove();
      }
    }
    nameSlides(thumbsTrack);
  }
  nameSlides(heroTrack);
}

let heroSlider: SliderInstance;
let heroThumbs: SliderInstance | null = null;
let syncTeardown: (() => void) | null = null;

function readDirection(): PlaygroundDirection {
  const value = new FormData(form).get("direction");
  return value === "rtl" || value === "ttb" ? value : "ltr";
}

function readConfig(): SliderConfig & { thumbnails?: boolean; slideCount?: number } {
  const fd = new FormData(form);
  const maxDotsVal = Number(fd.get("maxDots")) || 9;
  const alignment = (fd.get("alignment") as string) || "center";
  return {
    autoplay: fd.get("autoplay") === "on",
    autoplayInterval: Number(fd.get("autoplayInterval")) || 4000,
    loop: fd.get("loop") === "on",
    draggable: fd.get("draggable") === "on",
    alignment: alignment as SliderConfig["alignment"],
    vertical: readDirection() === "ttb",
    perMove: Number(fd.get("perMove")) || 1,
    thumbnails: fd.get("thumbnails") === "on",
    slideCount: Math.min(20, Math.max(3, Number(fd.get("slideCount")) || 5)),
    maxDots: maxDotsVal >= 21 ? undefined : maxDotsVal,
  };
}

function getFormBool(name: string): boolean {
  return (form.elements.namedItem(name) as HTMLInputElement | null)?.checked ?? false;
}

/** Add or remove nav/pagination DOM elements based on form state. Slider discovers them at init. */
function ensureHeroNavAndPagination(): void {
  const showNav = getFormBool("navigation");
  const showPagination = getFormBool("pagination");
  const viewport = heroSliderEl.querySelector<HTMLElement>(".aero-slider__viewport");
  if (!viewport) return;

  // Navigation: prev/next buttons inside viewport (before track)
  const track = heroSliderEl.querySelector<HTMLElement>(".aero-slider__track");
  let prevBtn = heroSliderEl.querySelector<HTMLButtonElement>(".aero-slider__nav--prev");
  let nextBtn = heroSliderEl.querySelector<HTMLButtonElement>(".aero-slider__nav--next");

  if (showNav) {
    if (!prevBtn) {
      prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "aero-slider__nav--prev";
      prevBtn.setAttribute("aria-label", "Previous slide");
      prevBtn.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`;
      viewport.insertBefore(prevBtn, track);
    }
    if (!nextBtn) {
      nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "aero-slider__nav--next";
      nextBtn.setAttribute("aria-label", "Next slide");
      nextBtn.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
      viewport.insertBefore(nextBtn, track);
    }
  } else {
    prevBtn?.remove();
    nextBtn?.remove();
  }

  // Pagination: container with one dot template, sibling to viewport
  let pagination = heroSliderEl.querySelector<HTMLElement>(".aero-slider__pagination");

  if (showPagination) {
    if (!pagination) {
      pagination = document.createElement("div");
      pagination.className = "aero-slider__pagination";
      pagination.setAttribute("role", "group");
      pagination.setAttribute("aria-label", "Slides");
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "aero-slider__dot";
      dot.setAttribute("aria-label", "Go to slide {index}");
      pagination.appendChild(dot);
      heroSliderEl.appendChild(pagination);
    }
  } else {
    pagination?.remove();
  }
}

function applyLayoutFromFormToContainer(container: HTMLElement): void {
  const fd = new FormData(form);
  const gap = Number(fd.get("gap")) || 0;
  const spvIndex = Number(fd.get("slidesPerView")) || 0;
  const spvValue = spvIndexToValue(spvIndex);
  container.style.setProperty("--aero-slides-per-view", String(spvValue));
  container.style.setProperty("--aero-slide-gap", `${gap}px`);
  container.toggleAttribute("data-flush", gap === 0);
}

function updateThumbnailState(show: boolean): void {
  heroThumbsWrapper.hidden = !show;
  if (show) {
    const loop = getFormBool("loop");
    if (!heroThumbs) {
      heroThumbs = createSlider(getRequiredElementById<HTMLElement>("hero-thumbs"), {
        loop,
        alignment: "center",
      });
    } else {
      heroThumbs.update({ loop, alignment: "center" });
    }
    if (syncTeardown) syncTeardown();
    syncTeardown = syncThumbnails(heroSlider, heroThumbs!, { loop });
  } else {
    if (syncTeardown) {
      syncTeardown();
      syncTeardown = null;
    }
  }
}

function rebuildHero(): void {
  if (syncTeardown) {
    syncTeardown();
    syncTeardown = null;
  }
  if (heroThumbs) {
    heroThumbs.destroy();
    heroThumbs = null;
  }
  if (heroSlider) {
    heroSlider.destroy();
  }

  const config = readConfig();
  const targetCount = config.slideCount ?? 5;
  reconcileSlideCount(targetCount);

  applyLayoutFromFormToContainer(heroSliderEl);
  if (readDirection() === "rtl") heroSliderEl.dir = "rtl";
  else heroSliderEl.removeAttribute("dir");
  ensureHeroNavAndPagination();
  heroSlider = createSlider(heroSliderEl, config);

  updateThumbnailState(config.thumbnails ?? false);
}

function initHero(): void {
  rebuildHero();
}

function updateAutoplayIntervalState(): void {
  const autoplayChecked =
    (form.elements.namedItem("autoplay") as HTMLInputElement)?.checked ?? false;
  const intervalControl = document.getElementById("interval-control");
  if (intervalControl) {
    intervalControl.classList.toggle("opacity-40", !autoplayChecked);
    intervalControl.classList.toggle("pointer-events-none", !autoplayChecked);
  }
}

form.addEventListener("input", (e) => {
  const target = e.target as HTMLInputElement;
  const out = outputs[target.name];
  if (out) out.textContent = formatOutputValue(target.name, target.value);

  if (target.name === "autoplay") {
    updateAutoplayIntervalState();
  }

  if (
    target.name === "slideCount" ||
    target.name === "pagination" ||
    target.name === "navigation" ||
    target.name === "direction"
  ) {
    rebuildHero();
    syncUrlFromForm();
    return;
  }

  applyLayoutFromFormToContainer(heroSliderEl);
  const config = readConfig();
  heroSlider.update(config);

  const thumbsChecked = config.thumbnails ?? false;
  updateThumbnailState(thumbsChecked);
  syncUrlFromForm();
});

form.addEventListener("change", (e) => {
  const target = e.target as HTMLInputElement;
  if (target.name === "thumbnails") {
    updateThumbnailState(target.checked);
  }
  syncUrlFromForm();
});

applyParamsFromUrl();
for (const [name, output] of Object.entries(outputs)) {
  const input = form.elements.namedItem(name) as HTMLInputElement | null;
  if (input) {
    output.textContent = formatOutputValue(name, input.value);
  }
}
document.documentElement.removeAttribute("data-aero-defer-hero");
initHero();
updateAutoplayIntervalState();

// ── Install Widget ────────────────────────────────────────────────────
const installCommands: Record<string, string> = {
  bun: "bun add aero-slider",
  npm: "npm install aero-slider",
  yarn: "yarn add aero-slider",
  pnpm: "pnpm add aero-slider",
};

const installWidget = document.getElementById("install-widget");
if (installWidget) {
  const tabs = installWidget.querySelectorAll<HTMLButtonElement>(".install-tab");
  const commandEl = document.getElementById("install-command");
  const copyBtn = document.getElementById("copy-install");
  const copyIcon = document.getElementById("copy-icon");
  const checkIcon = document.getElementById("check-icon");

  // Set initial active tab (bun)
  tabs[0]?.setAttribute("data-active", "");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.removeAttribute("data-active"));
      tab.setAttribute("data-active", "");
      const pm = tab.dataset.pm ?? "bun";
      if (commandEl) commandEl.textContent = installCommands[pm] ?? installCommands.bun;
    });
  });

  copyBtn?.addEventListener("click", async () => {
    const command = commandEl?.textContent ?? "";
    await navigator.clipboard.writeText(command);
    copyIcon?.classList.add("hidden");
    checkIcon?.classList.remove("hidden");
    setTimeout(() => {
      copyIcon?.classList.remove("hidden");
      checkIcon?.classList.add("hidden");
    }, 2000);
  });
}

// ── Mobile Draggable Tooltip ──────────────────────────────────────────
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
const draggableInput = form.querySelector<HTMLInputElement>('input[name="draggable"]');
const draggableLabel = draggableInput?.closest("label");

// ── Generated code ────────────────────────────────────────────────────
const codeBlock = getRequiredElementById<HTMLElement>("playground-code");

function readSettings(): PlaygroundSettings {
  const config = readConfig();
  const fd = new FormData(form);
  return {
    slideCount: config.slideCount ?? 5,
    slidesPerView: spvIndexToValue(Number(fd.get("slidesPerView")) || 0),
    gap: Number(fd.get("gap")) || 0,
    perMove: config.perMove ?? 1,
    maxDots: config.maxDots,
    autoplayInterval: config.autoplayInterval ?? 4000,
    alignment: config.alignment ?? "center",
    direction: readDirection(),
    loop: config.loop ?? false,
    pagination: getFormBool("pagination"),
    navigation: getFormBool("navigation"),
    draggable: config.draggable ?? true,
    autoplay: config.autoplay === true,
    thumbnails: config.thumbnails ?? false,
  };
}

const LIVE_LANGS = { html: "html", css: "css", js: "js" } as const;

function renderCode(): void {
  const code = playgroundCode(readSettings());
  for (const [key, lang] of Object.entries(LIVE_LANGS) as [keyof typeof LIVE_LANGS, LiveLang][]) {
    const panel = codeBlock.querySelector<HTMLElement>(`[data-panel="${key}"]`);
    if (panel) panel.innerHTML = highlight(code[key], lang);
  }
}

form.addEventListener("input", renderCode);
form.addEventListener("change", renderCode);
renderCode();

const codeToggle = getRequiredElementById<HTMLButtonElement>("code-toggle");
const codeContent = getRequiredElementById<HTMLElement>("code-content");
const codeToggleIcon = getRequiredElementById<HTMLElement>("code-toggle-icon");
codeToggle.addEventListener("click", () => {
  const expanded = codeToggle.getAttribute("aria-expanded") !== "true";
  codeToggle.setAttribute("aria-expanded", String(expanded));
  codeContent.classList.toggle("max-sm:hidden", !expanded);
  codeToggleIcon.textContent = expanded ? "−" : "+";
});

if (isTouchDevice && draggableLabel) {
  // Create tooltip element
  const tooltip = document.createElement("div");
  tooltip.className =
    "fixed z-50 max-w-xs rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs text-ink opacity-0 pointer-events-none transition-opacity";
  tooltip.textContent =
    "Touch devices have native swipe support — this setting is for enabling drag on desktop.";
  document.body.appendChild(tooltip);

  let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

  draggableLabel.addEventListener("click", (e) => {
    // Shake animation
    draggableLabel.style.animation = "none";
    draggableLabel.offsetHeight; // Trigger reflow
    draggableLabel.style.animation = "shake 0.5s ease-in-out";

    // Position and show tooltip
    const rect = draggableLabel.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.bottom + 8}px`;
    tooltip.style.transform = "translateX(-50%)";
    tooltip.style.opacity = "1";

    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => {
      tooltip.style.opacity = "0";
    }, 3000);
  });
}

import { createSlider, syncThumbnails } from "aero-slider";
import type { SliderConfig, SliderInstance } from "aero-slider";

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

function getRequiredElementById<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
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
const logList = getRequiredElementById<HTMLTableSectionElement>("event-log");
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
    const el = form.elements.namedItem(name) as HTMLSelectElement | null;
    if (el) el.value = val;
  };

  setRange("slideCount", 3, 20);
  setRange("slidesPerView", 0, 16);
  setRange("gap", 0, 32);
  setRange("autoplayInterval", 1000, 8000);
  setRange("maxDots", 3, 21);
  setRange("perMove", 1, 4);
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
  maxDots: "10",
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

const SLIDE_GRADIENTS = [
  ["from-indigo-500", "to-purple-600"],
  ["from-cyan-500", "to-blue-600"],
  ["from-emerald-500", "to-teal-600"],
  ["from-amber-500", "to-orange-600"],
  ["from-rose-500", "to-pink-600"],
  ["from-violet-400", "to-fuchsia-500"],
  ["from-sky-400", "to-indigo-500"],
  ["from-lime-400", "to-green-500"],
  ["from-yellow-400", "to-amber-500"],
  ["from-red-400", "to-rose-500"],
  ["from-teal-400", "to-cyan-500"],
  ["from-indigo-400", "to-purple-500"],
  ["from-blue-400", "to-indigo-600"],
  ["from-green-400", "to-teal-600"],
  ["from-orange-400", "to-red-500"],
  ["from-pink-400", "to-rose-600"],
  ["from-cyan-400", "to-blue-600"],
  ["from-emerald-400", "to-teal-600"],
  ["from-amber-400", "to-orange-600"],
  ["from-violet-500", "to-purple-600"],
] as const;

const ORDINALS = ["One", "Two", "Three", "Four", "Five"] as const;

function createHeroSlide(n: number): HTMLElement {
  const [from, to] = SLIDE_GRADIENTS[(n - 1) % SLIDE_GRADIENTS.length];
  const label = n <= 5 ? ORDINALS[n - 1] : String(n);
  const div = document.createElement("div");
  div.className = `bg-linear-to-br ${from} ${to} text-white rounded-2xl`;
  div.innerHTML = `<div class="flex flex-col items-center justify-center gap-2 p-8 text-center"><span class="text-5xl font-bold">${n}</span><span class="text-sm font-medium opacity-75">Slide ${label}</span></div>`;
  return div;
}

function createThumbSlide(n: number): HTMLElement {
  const [from, to] = SLIDE_GRADIENTS[(n - 1) % SLIDE_GRADIENTS.length];
  const div = document.createElement("div");
  div.className = `rounded-md bg-linear-to-br ${from} ${to} text-white`;
  div.innerHTML = `<div class="flex items-center justify-center text-xs font-bold">${n}</div>`;
  return div;
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
  }
}

let heroSlider: SliderInstance;
let heroThumbs: SliderInstance | null = null;
let syncTeardown: (() => void) | null = null;

function readConfig(): SliderConfig & { thumbnails?: boolean; slideCount?: number } {
  const fd = new FormData(form);
  const maxDotsVal = Number(fd.get("maxDots")) || 10;
  const direction = (fd.get("direction") as string) || "ltr";
  return {
    autoplay: fd.get("autoplay") === "on",
    autoplayInterval: Number(fd.get("autoplayInterval")) || 4000,
    loop: fd.get("loop") === "on",
    draggable: fd.get("draggable") === "on",
    direction: direction as "ltr" | "rtl" | "ttb",
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
      prevBtn.innerHTML = `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`;
      viewport.insertBefore(prevBtn, track);
    }
    if (!nextBtn) {
      nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "aero-slider__nav--next";
      nextBtn.setAttribute("aria-label", "Next slide");
      nextBtn.innerHTML = `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
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
      const dot = document.createElement("span");
      dot.className = "aero-slider__dot h-2.5 w-2.5 rounded-full bg-slate-300 transition-all";
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
  container.style.setProperty("--slides-per-view", String(spvValue));
  container.style.setProperty("--slide-gap", `${gap}px`);

  if (container.id === "hero-slider") {
    const slides = container.querySelectorAll(".aero-slider__track > div");
    for (const slide of slides) {
      if (gap > 0) {
        slide.classList.add("rounded-2xl");
      } else {
        slide.classList.remove("rounded-2xl");
      }
    }
  }
}

const eventLogEmpty = document.getElementById("event-log-empty");
const eventLogTable = document.getElementById("event-log-table");

function logEvent(name: string, data: { index: number; fromIndex?: number }): void {
  // Hide empty state, show table
  if (eventLogEmpty && eventLogTable) {
    eventLogEmpty.classList.add("hidden");
    eventLogTable.classList.remove("hidden");
  }

  const row = document.createElement("tr");
  row.className = "group hover:bg-slate-50 transition-colors";
  const time = new Date().toLocaleTimeString();
  const dataStr =
    data.fromIndex !== undefined ? `${data.fromIndex}→${data.index}` : `index=${data.index}`;
  row.innerHTML = `<td class="truncate px-4 py-2 font-medium text-slate-900">${name}</td><td class="truncate px-4 py-2 text-slate-500">${dataStr}</td><td class="px-4 py-2 text-left tabular-nums text-slate-400">${time}</td>`;
  logList.prepend(row);
  while (logList.children.length > 30) logList.lastElementChild?.remove();
}

function updateThumbnailState(show: boolean): void {
  heroThumbsWrapper.hidden = !show;
  if (show) {
    if (!heroThumbs) {
      heroThumbs = createSlider(getRequiredElementById<HTMLElement>("hero-thumbs"));
    }
    if (syncTeardown) syncTeardown();
    syncTeardown = syncThumbnails(heroSlider, heroThumbs!);
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
  ensureHeroNavAndPagination();
  heroSlider = createSlider(heroSliderEl, config);

  const events = [
    "slideChange",
    "dragStart",
    "dragEnd",
    "autoplayStart",
    "autoplayStop",
    "ready",
    "destroy",
    "resize",
    "resized",
    "visible",
    "hidden",
  ] as const;

  for (const event of events) {
    heroSlider.on(event, (d) => logEvent(event, d));
  }

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

// ── Mobile Event Log Collapse ─────────────────────────────────────────
const eventLogToggle = document.getElementById("event-log-toggle");
const eventLogContent = document.getElementById("event-log-content");
const eventLogIcon = document.getElementById("event-log-icon");

if (eventLogToggle && eventLogContent && eventLogIcon) {
  let isExpanded = true; // Start expanded on all devices

  // Set initial icon to minus (expanded state)
  eventLogIcon.innerHTML =
    '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" /></svg>';

  // Remove initial hidden classes
  eventLogContent.classList.remove("max-sm:hidden", "max-sm:h-0");

  eventLogToggle.addEventListener("click", () => {
    if (window.innerWidth >= 640) return; // Only toggle on mobile
    isExpanded = !isExpanded;
    eventLogContent.classList.toggle("max-sm:hidden", !isExpanded);
    eventLogContent.classList.toggle("max-sm:h-0", !isExpanded);
    eventLogIcon.innerHTML = isExpanded
      ? '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" /></svg>'
      : '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>';
  });
}

if (isTouchDevice && draggableLabel) {
  // Create tooltip element
  const tooltip = document.createElement("div");
  tooltip.className =
    "fixed z-50 max-w-xs px-3 py-2 text-xs text-white bg-slate-800 rounded-lg shadow-lg opacity-0 pointer-events-none transition-opacity";
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

// ── Examples (static, deferred so hero paints first) ──────────────────
requestAnimationFrame(() => {
  createSlider(getRequiredElementById<HTMLElement>("multi"));
  createSlider(getRequiredElementById<HTMLElement>("autoplay"), {
    autoplay: true,
    autoplayInterval: 3000,
    loop: true,
  });
  createSlider(getRequiredElementById<HTMLElement>("responsive"));

  const thumbMain = createSlider(getRequiredElementById<HTMLElement>("thumbnail-main"));
  const thumbThumbs = createSlider(getRequiredElementById<HTMLElement>("thumbnail-thumbs"));
  syncThumbnails(thumbMain, thumbThumbs);

  createSlider(getRequiredElementById<HTMLElement>("direction-rtl"), { direction: "rtl" });
  createSlider(getRequiredElementById<HTMLElement>("direction-vertical"), { direction: "ttb" });

  const dynamicSlider = createSlider(getRequiredElementById<HTMLElement>("dynamic-slides"));
  let dynamicCount = 3;
  const DYNAMIC_COLORS = [
    "bg-slate-700",
    "bg-slate-600",
    "bg-slate-500",
    "bg-indigo-600",
    "bg-emerald-600",
    "bg-amber-600",
    "bg-rose-600",
    "bg-violet-600",
  ];
  getRequiredElementById("dynamic-add").addEventListener("click", () => {
    dynamicCount++;
    const slide = document.createElement("div");
    slide.className = `rounded-lg ${DYNAMIC_COLORS[(dynamicCount - 1) % DYNAMIC_COLORS.length]} text-white`;
    slide.innerHTML = `<div class="flex items-center justify-center text-2xl font-bold">${dynamicCount}</div>`;
    dynamicSlider.add(slide);
  });
  getRequiredElementById("dynamic-remove").addEventListener("click", () => {
    if (dynamicSlider.slideCount > 1) {
      dynamicSlider.remove(dynamicSlider.slideCount - 1);
      dynamicCount = dynamicSlider.slideCount;
    }
  });

  createSlider(getRequiredElementById<HTMLElement>("per-move"), { perMove: 2, loop: true });
  createSlider(getRequiredElementById<HTMLElement>("pagination-minimal"));
  createSlider(getRequiredElementById<HTMLElement>("nav-minimal"));
});

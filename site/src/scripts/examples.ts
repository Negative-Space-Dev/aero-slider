import { createSlider, syncThumbnails } from "aero-slider";
import type { SliderConfig, SliderInstance } from "aero-slider";

function getRequiredElementById<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function formatOutputValue(name: string, value: string): string {
  if (name === "slidesPerView") {
    const n = Number(value);
    if (Number.isNaN(n)) return value;
    return n.toFixed(2).replace(/\.?0+$/, "");
  }
  if (name === "slideCount") {
    const n = Number(value);
    if (Number.isNaN(n)) return value;
    return String(Math.min(20, Math.max(3, Math.round(n))));
  }
  return value;
}

// ── Examples (static) ─────────────────────────────────────────────────
const multi = createSlider(getRequiredElementById<HTMLElement>("multi"), {
  pagination: true,
  navigation: true,
});

const autoplay = createSlider(getRequiredElementById<HTMLElement>("autoplay"), {
  autoplay: true,
  autoplayInterval: 3000,
  loop: true,
  pagination: true,
  navigation: true,
});

createSlider(getRequiredElementById<HTMLElement>("responsive"), {
  pagination: true,
  navigation: true,
});

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
};

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
  return {
    autoplay: fd.get("autoplay") === "on",
    autoplayInterval: Number(fd.get("autoplayInterval")) || 4000,
    loop: fd.get("loop") === "on",
    pagination: fd.get("pagination") === "on",
    navigation: fd.get("navigation") === "on",
    draggable: fd.get("draggable") === "on",
    thumbnails: fd.get("thumbnails") === "on",
    slideCount: Math.min(20, Math.max(3, Number(fd.get("slideCount")) || 5)),
  };
}

function applyLayoutFromFormToContainer(container: HTMLElement): void {
  const fd = new FormData(form);
  const gap = Number(fd.get("gap")) || 0;
  container.style.setProperty(
    "--slides-per-view",
    String(Number(fd.get("slidesPerView")) || 1),
  );
  container.style.setProperty(
    "--slide-gap",
    `${gap}px`,
  );

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

function logEvent(name: string, data: { index: number; fromIndex?: number }): void {
  const row = document.createElement("tr");
  row.className = "group hover:bg-slate-50 transition-colors";
  const time = new Date().toLocaleTimeString();
  const dataStr =
    data.fromIndex !== undefined
      ? `${data.fromIndex}→${data.index}`
      : `index=${data.index}`;
  row.innerHTML = `<td class="truncate px-4 py-2 font-medium text-slate-900">${name}</td><td class="truncate px-4 py-2 text-slate-500">${dataStr}</td><td class="px-4 py-2 text-left tabular-nums text-slate-400">${time}</td>`;
  logList.prepend(row);
  while (logList.children.length > 30) logList.lastElementChild?.remove();
}

function updateThumbnailState(show: boolean): void {
  heroThumbsWrapper.hidden = !show;
  if (show) {
    if (!heroThumbs) {
      heroThumbs = createSlider(getRequiredElementById<HTMLElement>("hero-thumbs"), {
        pagination: false,
        navigation: false,
      });
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
  heroSlider = createSlider(heroSliderEl, config);

  const events = [
    "slideChange",
    "dragStart",
    "dragEnd",
    "autoplayStart",
    "autoplayStop",
  ] as const;

  for (const event of events) {
    heroSlider.on(event, (d) => logEvent(event, d));
  }

  const showPagination = config.pagination && !config.thumbnails;
  heroSliderEl.classList.toggle("aero-slider--no-pagination", !showPagination);

  updateThumbnailState(config.thumbnails ?? false);
}

function initHero(): void {
  rebuildHero();
}

for (const [name, output] of Object.entries(outputs)) {
  const input = form.elements.namedItem(name) as HTMLInputElement | null;
  if (input) {
    output.textContent = formatOutputValue(name, input.value);
  }
}

form.addEventListener("input", (e) => {
  const target = e.target as HTMLInputElement;
  const out = outputs[target.name];
  if (out) out.textContent = formatOutputValue(target.name, target.value);

  if (target.name === "slideCount") {
    rebuildHero();
    return;
  }

  applyLayoutFromFormToContainer(heroSliderEl);
  const config = readConfig();
  heroSlider.update(config);

  const showPagination = config.pagination && !config.thumbnails;
  heroSliderEl.classList.toggle("aero-slider--no-pagination", !showPagination);

  const thumbsChecked = config.thumbnails ?? false;
  updateThumbnailState(thumbsChecked);
});

form.addEventListener("change", (e) => {
  const target = e.target as HTMLInputElement;
  if (target.name === "thumbnails") {
    const show = target.checked;
    updateThumbnailState(show);
    const config = readConfig();
    const showPagination = config.pagination && !show;
    heroSliderEl.classList.toggle("aero-slider--no-pagination", !showPagination);
  }
});

initHero();

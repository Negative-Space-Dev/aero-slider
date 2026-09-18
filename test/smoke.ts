// End-to-end smoke test: serves a fixture page built on dist/, drives headless
// Chrome over the DevTools protocol, and checks the behaviours that matter.
// Run with `bun run test` (builds first). Set CHROME to point at a browser binary.
import { existsSync } from "node:fs";

const chromePath =
  process.env.CHROME ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    Bun.which("google-chrome"),
    Bun.which("chromium"),
    Bun.which("chromium-browser"),
  ].find((p) => p && existsSync(p));
if (!chromePath) throw new Error("No Chrome found; set CHROME=/path/to/chrome");

const slide = (label: string) => `<div><div>${label}</div></div>`;
const slides = (n: number) => Array.from({ length: n }, (_, i) => slide(String(i))).join("");
const nav = `<button class="aero-slider__nav--prev" aria-label="Previous"></button><button class="aero-slider__nav--next" aria-label="Next"></button>`;
const dots = `<div class="aero-slider__pagination"><span class="aero-slider__dot" style="width:10px;height:10px"></span></div>`;
const slider = (id: string, n: number, style = "", extra = "") =>
  `<div id="${id}" class="aero-slider ${extra}" style="width:600px;${style}"><div class="aero-slider__viewport" style="position:relative">${nav}<div class="aero-slider__track">${slides(n)}</div></div>${dots}</div>`;

const page = `<!doctype html><html><head><link rel="stylesheet" href="/dist/aero-slider.min.css"></head><body style="margin:0">
${slider("basic", 5, "--slide-gap:10px")}
${slider("loop", 4, "--slides-per-view:1.5;--slide-gap:8px")}
<div style="width:1000px">${slider("breakout", 5, "width:1000px;--aero-layout-width:600px;--slides-per-view:1.2;--slide-gap:20px", "aero-slider--breakout")}</div>
${slider("rtl", 4)}
${slider("dots", 12, "--slides-per-view:3;--slide-gap:6px")}
<div id="hiddenWrap" style="display:none">${slider("hidden", 4)}</div>
<script type="module">
  import { createSlider } from "/dist/aero-slider.min.js";
  window.sliders = {
    basic: createSlider(document.getElementById("basic")),
    loop: createSlider(document.getElementById("loop"), { loop: true }),
    breakout: createSlider(document.getElementById("breakout"), { alignment: "left" }),
    rtl: createSlider(document.getElementById("rtl"), { direction: "rtl" }),
    dots: createSlider(document.getElementById("dots"), { loop: true, perMove: 2, maxDots: 5 }),
    hidden: createSlider(document.getElementById("hidden"), { loop: true }),
  };
</script></body></html>`;

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (path === "/") return new Response(page, { headers: { "content-type": "text/html" } });
    const file = Bun.file(`.${path}`);
    return (await file.exists()) ? new Response(file) : new Response(null, { status: 404 });
  },
});

// Runs in the page. Each check pushes a failure string when its condition is false.
const scenario = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const track = (id) => document.getElementById(id).querySelector(".aero-slider__track");
  const settled = async (id) => {
    const t = track(id);
    for (let last = -1, still = 0; still < 3; ) { await sleep(60); const p = t.scrollLeft + t.scrollTop; still = p === last ? still + 1 : 0; last = p; }
  };
  const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
  const failures = [];
  const check = (name, ok, info) => { if (!ok) failures.push(name + " " + JSON.stringify(info)); };
  const S = window.sliders;

  // Non-loop navigation, clamping, keyboard, nav buttons
  {
    const el = document.getElementById("basic"), s = S.basic, t = track("basic");
    const changes = []; el.addEventListener("aero:slideChange", (e) => changes.push(e.detail.index));
    s.next(); await settled("basic");
    check("basic.pageScrollChains", getComputedStyle(t).overscrollBehaviorY === "auto", getComputedStyle(t).overscrollBehavior);
    check("basic.next", s.currentIndex === 1 && near(t.scrollLeft, 610), { i: s.currentIndex, pos: t.scrollLeft });
    s.goTo(4); await settled("basic");
    check("basic.end", s.currentIndex === 4 && near(t.scrollLeft, t.scrollWidth - t.clientWidth) && el.querySelector(".aero-slider__nav--next").disabled, { i: s.currentIndex });
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })); await settled("basic");
    check("basic.keyboard", s.currentIndex === 3 && near(t.scrollLeft, 1830), { i: s.currentIndex, pos: t.scrollLeft });
    el.querySelector(".aero-slider__nav--prev").click(); await settled("basic");
    check("basic.navButton", s.currentIndex === 2, { i: s.currentIndex });
    t.scrollLeft = 0; await settled("basic");
    check("basic.userScroll", s.currentIndex === 0, { i: s.currentIndex });
    check("basic.events", changes.join() === "1,4,3,2,0", changes);
    check("basic.dots", [...el.querySelectorAll(".aero-slider__dot")].map((d) => d.classList.contains("aero-slider__dot--active")).join() === "true,false,false,false,false", {});
  }

  // Loop: clones, wrapping both ways, teleport back onto real slides, drag wrap
  {
    const el = document.getElementById("loop"), s = S.loop, t = track("loop");
    const kids = t.children, n = 4, before = (kids.length - n) / 2;
    const restOf = (k) => { const r = kids[k].getBoundingClientRect(), tr = t.getBoundingClientRect(); return t.scrollLeft + (r.left + r.right) / 2 - tr.left - t.clientWidth / 2; };
    check("loop.clones", kids.length === 12 && kids[0].getAttribute("aria-hidden") === "true", { kids: kids.length });
    check("loop.start", s.currentIndex === 0 && near(t.scrollLeft, restOf(before)), { pos: t.scrollLeft, want: restOf(before) });
    s.prev(); await settled("loop");
    check("loop.prevWraps", s.currentIndex === 3 && near(t.scrollLeft, restOf(before + 3)), { i: s.currentIndex, pos: t.scrollLeft, want: restOf(before + 3) });
    s.next(); await settled("loop");
    check("loop.nextWraps", s.currentIndex === 0 && near(t.scrollLeft, restOf(before)), { i: s.currentIndex, pos: t.scrollLeft });
    t.scrollLeft = restOf(before + n + 2); await settled("loop");
    check("loop.teleport", s.currentIndex === 2 && near(t.scrollLeft, restOf(before + 2)), { i: s.currentIndex, pos: t.scrollLeft });
    const changes = []; el.addEventListener("aero:slideChange", (e) => changes.push(e.detail.index));
    t.scrollLeft = restOf(before + n + 1); await sleep(20); s.next(); await settled("loop");
    check("loop.navFromRunway", s.currentIndex === 2 && near(t.scrollLeft, restOf(before + 2)) && changes.join() === "1,2", { i: s.currentIndex, changes });
  }

  // Drag: threshold, live tracking, flick advances one slide, no index flicker
  {
    const el = document.getElementById("basic"), s = S.basic, t = track("basic");
    const log = []; for (const n of ["dragStart", "dragEnd", "slideChange"]) el.addEventListener("aero:" + n, (e) => log.push(n + e.detail.index));
    const r = t.getBoundingClientRect(), x0 = r.left + 300, y = r.top + 100;
    const pe = (type, x, extra = {}) => t.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y, ...extra }));
    pe("pointerdown", x0); pe("pointermove", x0 - 3); await sleep(16);
    check("drag.threshold", !el.classList.contains("aero-slider--dragging"), {});
    for (let i = 1; i <= 6; i++) { pe("pointermove", x0 - i * 20); await sleep(16); }
    check("drag.tracks", el.classList.contains("aero-slider--dragging") && near(t.scrollLeft, 120) && t.style.scrollSnapType === "none", { pos: t.scrollLeft });
    pe("pointerup", x0 - 120, { buttons: 0 }); await settled("basic");
    check("drag.flick", s.currentIndex === 1 && near(t.scrollLeft, 610) && t.style.scrollSnapType === "" && log.join() === "dragStart0,slideChange1,dragEnd1", { i: s.currentIndex, pos: t.scrollLeft, log });
  }

  // Breakout: padding is the snap inset for every alignment
  {
    const s = S.breakout, t = track("breakout"), pad = parseFloat(getComputedStyle(t).paddingLeft);
    const edge = (i) => { const r = t.children[i].getBoundingClientRect(), tr = t.getBoundingClientRect(); return { left: r.left - tr.left, right: tr.right - r.right, center: (r.left + r.right) / 2 - tr.left }; };
    check("breakout.padding", near(pad, 200), { pad });
    s.goTo(2); await settled("breakout");
    check("breakout.left", near(edge(2).left, pad), edge(2));
    s.update({ alignment: "center" }); s.goTo(1); await settled("breakout");
    check("breakout.center", near(edge(1).center, t.clientWidth / 2), edge(1));
    s.update({ alignment: "right" }); s.goTo(2); await settled("breakout");
    check("breakout.right", near(edge(2).right, pad), edge(2));
  }

  // RTL: logical positions, keyboard mirroring
  {
    const el = document.getElementById("rtl"), s = S.rtl, t = track("rtl");
    s.next(); await settled("rtl");
    check("rtl.next", s.currentIndex === 1 && near(t.scrollLeft, -600) && el.getAttribute("dir") === "rtl", { pos: t.scrollLeft });
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); await settled("rtl");
    check("rtl.arrowRightIsBack", s.currentIndex === 0 && t.scrollLeft === 0, { i: s.currentIndex });
  }

  // Windowed pagination and perMove
  {
    const el = document.getElementById("dots"), s = S.dots, box = el.querySelector(".aero-slider__pagination");
    const mods = () => [...box.querySelectorAll(".aero-slider__pagination-track .aero-slider__dot")].map((d) => (d.classList.contains("aero-slider__dot--active") ? "A" : d.classList.contains("aero-slider__dot--hidden") ? "_" : d.classList.contains("aero-slider__dot--edge") ? "e" : d.classList.contains("aero-slider__dot--near-edge") ? "n" : ".")).join("");
    check("dots.windowed", box.classList.contains("aero-slider__pagination--windowed") && mods() === "A..ne_______", { mods: mods() });
    s.next(); await settled("dots");
    check("dots.perMove", s.currentIndex === 2, { i: s.currentIndex });
    s.goTo(6); await sleep(400);
    const [d0, d1] = box.querySelectorAll(".aero-slider__pagination-track .aero-slider__dot");
    const offset = box.querySelector(".aero-slider__pagination-track").style.getPropertyValue("--track-offset");
    check("dots.window", mods() === "____enAne___" && offset === "-" + 4 * (d1.offsetLeft - d0.offsetLeft) + "px", { mods: mods(), offset });
  }

  // Created while hidden: goTo() is remembered and layout catches up on show
  {
    const el = document.getElementById("hidden"), s = S.hidden, t = track("hidden");
    const log = []; el.addEventListener("aero:slideChange", (e) => log.push(e.detail.index));
    s.goTo(2); await sleep(50);
    check("hidden.goTo", s.currentIndex === 2 && t.scrollLeft === 0, { i: s.currentIndex, pos: t.scrollLeft });
    document.getElementById("hiddenWrap").style.display = ""; await settled("hidden");
    const before = (t.children.length - 4) / 2, r = t.children[before + 2].getBoundingClientRect(), tr = t.getBoundingClientRect();
    check("hidden.shown", s.currentIndex === 2 && near((r.left + r.right) / 2 - tr.left, t.clientWidth / 2) && log.join() === "2", { i: s.currentIndex, log, center: (r.left + r.right) / 2 - tr.left });
    s.next(); await settled("hidden");
    check("hidden.next", s.currentIndex === 3, { i: s.currentIndex });
  }

  // Destroy leaves the DOM clean and the API inert
  {
    const el = document.getElementById("rtl"), s = S.rtl;
    s.destroy(); s.next();
    check("destroy", !el.aeroSlider && !el.hasAttribute("tabindex") && !el.hasAttribute("dir") && el.querySelectorAll(".aero-slider__dot").length === 1, {});
  }
  return failures;
})()`;

const port = 9222 + Math.floor(Math.random() * 500);
const chrome = Bun.spawn(
  [
    chromePath,
    "--headless=new",
    "--no-first-run",
    "--disable-gpu",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/aero-slider-smoke-${port}`,
    "--window-size=1280,900",
    "about:blank",
  ],
  { stdout: "ignore", stderr: "ignore" }
);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let target: { webSocketDebuggerUrl: string } | undefined;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    target = await (
      await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:${server.port}/`, {
        method: "PUT",
      })
    ).json();
  } catch {}
}
if (!target) throw new Error("Chrome did not start");

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let nextId = 0;
const pending = new Map<number, (v: any) => void>();
const errors: string[] = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(String(m.data));
  if (msg.id) pending.get(msg.id)?.(msg.result ?? msg.error);
  if (msg.method === "Runtime.exceptionThrown")
    errors.push(
      msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text
    );
};
const send = (method: string, params = {}) =>
  new Promise<any>((r) => {
    pending.set(++nextId, r);
    ws.send(JSON.stringify({ id: nextId, method, params }));
  });

await send("Runtime.enable");
await sleep(800);
const result = await send("Runtime.evaluate", {
  expression: scenario,
  awaitPromise: true,
  returnByValue: true,
});
ws.close();
chrome.kill();
server.stop();

const failures: string[] = [
  ...(result.result?.value ?? [`evaluate failed: ${JSON.stringify(result)}`]),
  ...errors.map((e) => "page error: " + e),
];
if (failures.length) {
  console.error("FAIL\n" + failures.join("\n"));
  process.exit(1);
}
console.log("ok: slider smoke test passed");

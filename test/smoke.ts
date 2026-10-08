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
${slider("fixed", 5, "--slide-gap:10px")}
${slider("ticking", 4)}
${slider("interval", 4)}
${slider("eased", 5, "--slide-gap:10px")}
${slider("linear", 5, "--slide-gap:10px")}
${slider("longEase", 5, "--slide-gap:10px")}
${slider("slowAuto", 4)}
${slider("nest", 3).replace("<div><div>0</div></div>", `<div>${slider("nested", 3)}</div>`)}
${slider("multi", 4)}
${slider("stopper", 3).replace("<div><div>0</div></div>", '<div><button id="stopBtn">0</button></div>')}
${slider("doomed", 3)}
${slider("settle", 5, "--slide-gap:10px")}
${slider("settleLoop", 4, "--slide-gap:10px")}
${slider("free", 5, "--slide-gap:10px")}
${slider("settleTtb", 4, "height:300px")}
<div id="cards" class="aero-slider" style="width:600px"><div class="aero-slider__viewport"><div class="aero-slider__track">${Array.from({ length: 3 }, (_, i) => `<a href="#card${i}" id="card${i}">${i}</a>`).join("")}</div></div></div>
<script type="module">
  import { createSlider } from "/dist/aero-slider.min.js";
  window.sliders = {
    basic: createSlider(document.getElementById("basic")),
    loop: createSlider(document.getElementById("loop"), { loop: true }),
    breakout: createSlider(document.getElementById("breakout"), { alignment: "left" }),
    rtl: createSlider(document.getElementById("rtl"), { direction: "rtl" }),
    dots: createSlider(document.getElementById("dots"), { loop: true, perMove: 2, maxDots: 5 }),
    hidden: createSlider(document.getElementById("hidden"), { loop: true }),
    fixed: createSlider(document.getElementById("fixed"), { draggable: false }),
    ticking: createSlider(document.getElementById("ticking"), { loop: true, autoplay: true, autoplayInterval: 300 }),
    interval: createSlider(document.getElementById("interval"), { loop: true, autoplay: true, autoplayInterval: 400 }),
    eased: createSlider(document.getElementById("eased"), { scrollDuration: 300 }),
    linear: createSlider(document.getElementById("linear"), { scrollDuration: 400, scrollEasing: (t) => t }),
    longEase: createSlider(document.getElementById("longEase"), { scrollDuration: 2000 }),
    slowAuto: createSlider(document.getElementById("slowAuto"), { loop: true, autoplay: true, autoplayInterval: 300, scrollDuration: 900 }),
    nest: createSlider(document.getElementById("nest"), { loop: true, autoplay: true, autoplayInterval: 400 }),
    nested: createSlider(document.getElementById("nested"), { loop: true, autoplay: true, autoplayInterval: 150 }),
    multi: createSlider(document.getElementById("multi"), { loop: true, autoplay: true, autoplayInterval: 400 }),
    stopper: createSlider(document.getElementById("stopper"), { loop: true, autoplay: true, autoplayInterval: 150 }),
    doomed: createSlider(document.getElementById("doomed"), { loop: true, autoplay: true, autoplayInterval: 100 }),
    cards: createSlider(document.getElementById("cards"), { loop: true }),
    settle: createSlider(document.getElementById("settle"), { snap: "settle", scrollDuration: 300 }),
    settleLoop: createSlider(document.getElementById("settleLoop"), { loop: true, snap: "settle", scrollDuration: 300 }),
    free: createSlider(document.getElementById("free"), { snap: "none", scrollDuration: 300 }),
    settleTtb: createSlider(document.getElementById("settleTtb"), { direction: "ttb", snap: "settle" }),
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
    for (let last = -1, still = 0, tries = 0; still < 3 && tries < 60; tries++) { await sleep(60); const p = t.scrollLeft + t.scrollTop; still = p === last ? still + 1 : 0; last = p; }
  };
  // Scroll position on every animation frame for \`ms\`, to check how a scroll moves, not just where it ends.
  const frames = async (id, ms) => {
    const t = track(id), out = [], end = performance.now() + ms;
    while (performance.now() < end) { await new Promise(requestAnimationFrame); out.push(t.scrollLeft + t.scrollTop); }
    return out;
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
    // Drag moves apply on the next frame, so wait for it. That also leaves the scroll's index read
    // queued at release, which used to flicker the index 1 → 0 → 1. The 16 ms floor keeps headless
    // frames that land back to back from reading as a much faster flick that moves two slides.
    for (let i = 1; i <= 6; i++) { pe("pointermove", x0 - i * 20); await sleep(16); await new Promise(requestAnimationFrame); }
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

  // The grab cursor only shows on draggable sliders
  check("cursor.fixed", getComputedStyle(track("fixed")).cursor !== "grab", getComputedStyle(track("fixed")).cursor);
  check("cursor.draggable", getComputedStyle(track("basic")).cursor === "grab", getComputedStyle(track("basic")).cursor);

  // goTo(..., { instant: true }) jumps with no animation, and the next move still animates from there
  {
    const s = S.fixed, t = track("fixed");
    s.goTo(3, { instant: true });
    check("goTo.instant", s.currentIndex === 3 && near(t.scrollLeft, 1830), { i: s.currentIndex, pos: t.scrollLeft });
    await settled("fixed");
    const end = t.scrollWidth - t.clientWidth;
    s.next();
    const path = await frames("fixed", 500);
    const between = path.filter((p) => p > 1831 && p < end - 1);
    check("goTo.instant.nextAnimates", new Set(between).size >= 3 && path.every((p, k) => !k || p >= path[k - 1]), { path });
    await settled("fixed");
    check("goTo.instant.nextLands", s.currentIndex === 4 && near(t.scrollLeft, t.scrollWidth - t.clientWidth), { i: s.currentIndex, pos: t.scrollLeft });
    // Reversing a move before it leaves the spot stops it there, instantly or smoothly
    s.goTo(0, { instant: true }); await settled("fixed");
    s.goTo(3); s.goTo(0, { instant: true }); await settled("fixed");
    check("goTo.reverseInstant", s.currentIndex === 0 && near(t.scrollLeft, 0), { i: s.currentIndex, pos: t.scrollLeft });
    s.goTo(0, { instant: true }); await settled("fixed");
    s.goTo(3); s.goTo(0); await settled("fixed");
    check("goTo.reverseSmooth", s.currentIndex === 0 && near(t.scrollLeft, 0), { i: s.currentIndex, pos: t.scrollLeft });
  }

  // Clones of link slides leave the tab order and drop their ids
  {
    const clones = [...track("cards").querySelectorAll("[data-aero-slider-clone]")];
    check("clones.linkSlides", clones.length > 0 && clones.every((c) => c.tabIndex === -1 && !c.id && c.getAttribute("aria-hidden") === "true"), { n: clones.length, tabbable: clones.filter((c) => c.tabIndex !== -1).length });
  }

  // Interval autoplay: restarts after a manual change, pause()/resume(), holds while pressed
  {
    const s = S.interval, t = track("interval"), el = document.getElementById("interval");
    // Two jumps so at least one is a change, which restarts the countdown from here.
    s.goTo(1, { instant: true }); s.goTo(0, { instant: true }); await sleep(470);
    check("interval.advances", s.currentIndex === 1, { i: s.currentIndex });
    await sleep(150); s.goTo(3);
    await sleep(300);
    check("interval.restartsAfterManual", s.currentIndex === 3, { i: s.currentIndex });
    await sleep(170);
    check("interval.wraps", s.currentIndex === 0, { i: s.currentIndex });
    s.pause(); await sleep(500);
    check("interval.pause", s.currentIndex === 0, { i: s.currentIndex });
    s.resume(); await sleep(450);
    check("interval.resume", s.currentIndex === 1, { i: s.currentIndex });
    const r = t.getBoundingClientRect();
    const press = () => t.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 2, pointerType: "mouse", button: 0, buttons: 1, clientX: r.left + 10, clientY: r.top + 10 }));
    const lift = () => window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 2, pointerType: "mouse" }));
    press();
    const pressedAt = s.currentIndex; await sleep(600);
    check("interval.holdsWhilePressed", s.currentIndex === pressedAt, { i: s.currentIndex });
    lift(); await sleep(600);
    check("interval.resumesAfterPress", s.currentIndex !== pressedAt, { i: s.currentIndex });
    // A press that sets off a scroll (a fling) waits for it to settle, not the 150ms fallback.
    let settledAt = 0, startedAt = 0;
    // Capture runs before the slider's own scrollend handler, which is what restarts autoplay.
    t.addEventListener("scrollend", () => (settledAt ||= performance.now()), { capture: true });
    el.addEventListener("aero:autoplayStart", () => (startedAt ||= performance.now()));
    press(); lift(); t.scrollBy({ left: 300, behavior: "smooth" });
    await sleep(1200);
    check("interval.waitsForSettle", settledAt > 0 && startedAt >= settledAt, { settledAt, startedAt });
    s.update({ autoplay: false });
  }

  // scrollDuration eases goTo() on its own timeline: every frame moves a little the same way, faster
  // first (ease-out), with snapping off until it lands exactly. Snapping left on pulls each frame to
  // a slide, so the path jumps 0 → 610 → 1220.
  const glide = (path, from, to) => {
    const steps = path.slice(1).map((p, k) => p - path[k]).filter((d) => d !== 0);
    const half = Math.floor(steps.length / 2), avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    return {
      steps: steps.length,
      oneWay: steps.every((d) => Math.sign(d) === Math.sign(to - from)),
      biggest: Math.max(0, ...steps.map(Math.abs)) / Math.abs(to - from),
      firstHalf: Math.abs(avg(steps.slice(0, half))),
      secondHalf: Math.abs(avg(steps.slice(half))),
    };
  };
  {
    const s = S.eased, t = track("eased");
    s.goTo(2);
    check("eased.snapOffWhileEasing", t.style.scrollSnapType === "none", t.style.scrollSnapType);
    const path = await frames("eased", 450), g = glide(path, 0, 1220);
    check("eased.smooth", g.steps >= 8 && g.oneWay && g.biggest < 0.3, { g, path });
    check("eased.easesOut", g.firstHalf > g.secondHalf, { g });
    await settled("eased");
    check("eased.lands", s.currentIndex === 2 && near(t.scrollLeft, 1220), { i: s.currentIndex, pos: t.scrollLeft });
    check("eased.snapRestored", t.style.scrollSnapType === "", t.style.scrollSnapType);
  }

  // scrollEasing shapes the curve: linear moves in even steps (ease-out front-loads them)
  {
    const s = S.linear, t = track("linear");
    s.goTo(2);
    const path = await frames("linear", 550), g = glide(path, 0, 1220);
    check("easing.custom", g.steps >= 12 && g.oneWay && g.biggest < 0.15, { g, path });
    await settled("linear");
    check("easing.customLands", near(t.scrollLeft, 1220), { pos: t.scrollLeft });
    // Back the other way glides too
    s.goTo(0);
    const back = glide(await frames("linear", 550), 1220, 0);
    check("easing.reverse", back.steps >= 12 && back.oneWay && back.biggest < 0.15, { back });
    await settled("linear");
  }

  // The wheel and a mouse press stop an eased scroll where it is
  {
    const s = S.eased, t = track("eased");
    s.goTo(4); await sleep(100);
    t.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: 1 }));
    await sleep(400);
    check("eased.wheelTakesOver", t.scrollLeft < 2340, { pos: t.scrollLeft });
    // Snapping comes back, so an interrupted scroll still comes to rest on a slide.
    await settled("eased");
    check("eased.interruptedSnaps", t.style.scrollSnapType === "" && near(t.scrollLeft % 610, 0, 2) , { snap: t.style.scrollSnapType, pos: t.scrollLeft });
    s.goTo(0, { instant: true }); await settled("eased");
    s.goTo(4); await sleep(100);
    const r = t.getBoundingClientRect();
    t.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 3, pointerType: "mouse", button: 0, buttons: 1, clientX: r.left + 10, clientY: r.top + 10 }));
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 3, pointerType: "mouse" }));
    await sleep(400);
    check("eased.pressTakesOver", t.scrollLeft < 2340, { pos: t.scrollLeft });
    s.goTo(0, { instant: true }); await settled("eased");
  }

  // Autoplay doesn't cut off its own eased move when scrollDuration outlasts the interval: each move
  // comes to rest on a slide before the next starts.
  {
    const t = track("slowAuto"), stride = t.children[1].offsetLeft - t.children[0].offsetLeft;
    let rests = 0, still = 0, last = -1;
    for (let i = 0; i < 40; i++) {
      await sleep(75);
      const p = t.scrollLeft;
      still = p === last ? still + 1 : 0; last = p;
      if (still === 1 && near(p % stride, 0, 2)) rests++;
    }
    check("autoplay.waitsForEase", rests >= 2, { rests });
  }

  // Autoplay edge cases
  {
    // A nested slider's slideChange bubbles up; only the slider's own changes restart its countdown.
    const parent = document.getElementById("nest");
    let own = 0;
    parent.addEventListener("aero:slideChange", (e) => e.target === parent && own++);
    await sleep(1000);
    check("autoplay.ignoresNestedSlider", own >= 1, { own, nested: S.nested.currentIndex });

    // Two fingers down: lifting one keeps the hold until the last one lifts.
    const t = track("multi"), s = S.multi;
    const down = (id) => t.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: id, pointerType: "touch" }));
    const up = (id) => window.dispatchEvent(new PointerEvent("pointerup", { pointerId: id, pointerType: "touch" }));
    // Count moves rather than compare indices: a loop can come back round to the same one.
    const moves = (id) => { const el = document.getElementById(id), n = { v: 0 }; el.addEventListener("aero:slideChange", (e) => e.target === el && n.v++); return n; };
    const multiMoves = moves("multi");
    // Start from rest, so a move already under way isn't counted; then only the press holds autoplay.
    s.pause(); await settled("multi");
    down(41); down(42); s.resume();
    const at = s.currentIndex; multiMoves.v = 0;
    up(41); await sleep(900);
    check("autoplay.holdsUntilLastPointer", multiMoves.v === 0, { at, moves: multiMoves.v });
    multiMoves.v = 0; up(42); await sleep(900);
    check("autoplay.resumesAfterLastPointer", multiMoves.v >= 1, { at, moves: multiMoves.v });

    // Content that stops pointerup from bubbling can't strand the press hold.
    const btn = document.getElementById("stopBtn");
    btn.addEventListener("pointerup", (e) => e.stopPropagation());
    btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 43, pointerType: "touch" }));
    btn.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 43, pointerType: "touch" }));
    const stopperMoves = moves("stopper"); await sleep(700);
    check("autoplay.resumesWhenReleaseIsStopped", stopperMoves.v >= 1, { moves: stopperMoves.v });

    // resume() after destroy() stays inert.
    const doomed = document.getElementById("doomed");
    let starts = 0;
    doomed.addEventListener("aero:autoplayStart", () => starts++);
    S.doomed.destroy(); S.doomed.resume(); await sleep(50);
    check("autoplay.resumeAfterDestroy", starts === 0, { starts });
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

// Reduced motion, switched on and off while the page runs: scrolls turn instant and autoplay stops,
// then autoplay comes back.
const inPage = async (body: string) =>
  (
    await send("Runtime.evaluate", {
      expression: `(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const near = (a, b) => Math.abs(a - b) <= 1.5;
        const S = window.sliders, track = (id) => document.getElementById(id).querySelector(".aero-slider__track");
        const failures = [];
        const check = (name, ok, info) => { if (!ok) failures.push(name + " " + JSON.stringify(info)); };
        ${body}
        return failures;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    })
  ).result?.value ?? ["reduced-motion evaluate failed"];
const setReducedMotion = (value: string) =>
  send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value }] });

// A real touch stops an eased scroll too: touch fires pointerdown, so no touchstart listener is needed.
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
const touchAt = (
  await send("Runtime.evaluate", {
    expression: `(() => {
      const el = document.getElementById("eased");
      el.scrollIntoView({ block: "center" });
      window.sliders.eased.goTo(4);
      const r = el.getBoundingClientRect();
      return { x: r.left + 200, y: r.top + 20 };
    })()`,
    returnByValue: true,
  })
).result.value;
await sleep(90);
await send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: touchAt ? [touchAt] : [],
});
await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await send("Emulation.setTouchEmulationEnabled", { enabled: false });
const touched = await inPage(`
  await sleep(400);
  check("eased.touchTakesOver", track("eased").scrollLeft < 2340, { pos: track("eased").scrollLeft });
`);

// Snap modes. Helpers for this phase: every-frame sampling, settling, and a real wheel over CDP.
const snapHelpers = `
  const frames = async (id, ms) => {
    const t = track(id), out = [], end = performance.now() + ms;
    while (performance.now() < end) { await new Promise(requestAnimationFrame); out.push(t.scrollLeft + t.scrollTop); }
    return out;
  };
  const settled = async (id) => {
    const t = track(id);
    for (let last = -1, still = 0, n = 0; still < 3 && n < 60; n++) { await sleep(60); const p = t.scrollLeft + t.scrollTop; still = p === last ? still + 1 : 0; last = p; }
  };
  const stepsOf = (path) => path.slice(1).map((p, k) => p - path[k]).filter((d) => d !== 0);
  const pe = (id, type, x, extra = {}) => { const t = track(id), r = t.getBoundingClientRect(); t.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1, clientX: r.left + x, clientY: r.top + 50, ...extra })); };
  const drag = async (id, from, to, step) => {
    pe(id, "pointerdown", from); await sleep(16); await new Promise(requestAnimationFrame);
    for (let x = from - step; step > 0 ? x >= to : x <= to; x -= step) { pe(id, "pointermove", x); await sleep(16); await new Promise(requestAnimationFrame); }
  };
`;
const wheel = async (id: string, deltaX: number) => {
  const at = (
    await send("Runtime.evaluate", {
      expression: `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 60 }; })()`,
      returnByValue: true,
    })
  ).result.value;
  await sleep(100);
  await send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: at.x,
    y: at.y,
    deltaX,
    deltaY: 0,
  });
};

const snapped = await inPage(`${snapHelpers}
  // Native snapping stays the default; free modes turn CSS snapping off, even on a vertical track.
  check("snap.nativeByDefault", !document.getElementById("basic").classList.contains("aero-slider--free") && getComputedStyle(track("basic")).scrollSnapType.includes("mandatory"), getComputedStyle(track("basic")).scrollSnapType);
  for (const id of ["settle", "free", "settleTtb"]) {
    check("snap.free." + id, document.getElementById(id).classList.contains("aero-slider--free") && getComputedStyle(track(id)).scrollSnapType === "none", getComputedStyle(track(id)).scrollSnapType);
  }

  // settle: a free scroll stays put while it moves, then eases onto the nearest slide.
  {
    const t = track("settle"), s = S.settle;
    t.scrollLeft = 820;
    const path = await frames("settle", 700), steps = stepsOf(path);
    check("settle.scrollsFreely", near(path[0], 820), { first: path[0] });
    check("settle.easesOntoNearest", steps.length >= 6 && steps.every((d) => d < 0) && Math.max(...steps.map(Math.abs)) < 210 * 0.4, { path });
    await settled("settle");
    check("settle.lands", s.currentIndex === 1 && near(t.scrollLeft, 610), { i: s.currentIndex, pos: t.scrollLeft });
  }

  // settle: a mouse drag moves freely with the pointer, then the release eases exactly onto a slide.
  {
    const t = track("settle"), s = S.settle;
    s.goTo(0, { instant: true }); await settled("settle");
    await drag("settle", 500, 100, 20);
    check("settle.dragFollows", near(t.scrollLeft, 400), { pos: t.scrollLeft });
    await sleep(250); // let the drag's velocity decay to a dead stop
    pe("settle", "pointerup", 100, { buttons: 0 });
    const path = await frames("settle", 600), steps = stepsOf(path);
    check("settle.dragEases", steps.length >= 6 && steps.every((d) => d > 0), { path });
    await settled("settle");
    check("settle.dragLands", s.currentIndex === 1 && near(t.scrollLeft, 610), { i: s.currentIndex, pos: t.scrollLeft });
  }

  // settle on a loop: past the last real slide, it eases onto the nearest slide on screen (a clone),
  // then teleports to the real copy. It never flies back across the track to get there.
  {
    const t = track("settleLoop"), s = S.settleLoop, kids = t.children;
    const pos = (i) => kids[i].offsetLeft - kids[0].offsetLeft;
    const lastReal = [...kids].findLastIndex((k) => !k.hasAttribute("data-aero-slider-clone"));
    s.goTo(3, { instant: true }); await settled("settleLoop");
    const from = pos(lastReal) + 488, clone = pos(lastReal + 1), home = pos(lastReal - 3);
    t.scrollLeft = from;
    const path = await frames("settleLoop", 700);
    const jump = path.findIndex((p, k) => k && Math.abs(p - path[k - 1]) > 300);
    const before = jump < 0 ? path : path.slice(0, jump), after = jump < 0 ? [] : path.slice(jump);
    check("settleLoop.easesOntoClone", before.length >= 6 && before.every((p, k) => p >= from - 1 && p <= clone + 1 && (!k || p >= before[k - 1])) && Math.abs(before.at(-1) - clone) <= 4, { from, clone, before });
    check("settleLoop.thenTeleports", after.length > 0 && after.every((p) => near(p, home)), { home, after: after.slice(0, 5) });
    await settled("settleLoop");
    check("settleLoop.lands", s.currentIndex === 0 && near(t.scrollLeft, home), { i: s.currentIndex, pos: t.scrollLeft, home });
  }

  // Firefox can skip scrollend after wheel scrolling; the wheel's own settle timer covers it.
  {
    const el = document.getElementById("settle"), t = track("settle"), s = S.settle;
    s.goTo(0, { instant: true }); await settled("settle");
    const block = (e) => e.stopPropagation();
    el.addEventListener("scrollend", block, { capture: true });
    t.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaX: 1 }));
    t.scrollLeft = 820;
    await sleep(900);
    el.removeEventListener("scrollend", block, { capture: true });
    check("settle.withoutScrollend", s.currentIndex === 1 && near(t.scrollLeft, 610), { i: s.currentIndex, pos: t.scrollLeft });
  }

  // none: the track rests wherever it stops, a drag release coasts on its momentum, and the index
  // follows the nearest slide.
  {
    const t = track("free"), s = S.free;
    t.scrollLeft = 820; await settled("free"); await sleep(400);
    check("none.restsWhereItStops", near(t.scrollLeft, 820) && s.currentIndex === 1, { pos: t.scrollLeft, i: s.currentIndex });
    s.goTo(0, { instant: true }); await settled("free");
    await drag("free", 500, 100, 20);
    await sleep(250);
    pe("free", "pointerup", 100, { buttons: 0 }); await settled("free");
    check("none.dragRestsWhereReleased", near(t.scrollLeft, 400), { pos: t.scrollLeft });
    s.goTo(0, { instant: true }); await settled("free");
    await drag("free", 400, 280, 20);
    pe("free", "pointerup", 280, { buttons: 0 });
    const path = await frames("free", 500), steps = stepsOf(path);
    await settled("free");
    const rest = t.scrollLeft;
    check("none.flickCoasts", steps.length >= 4 && steps.every((d) => d > 0) && rest > 170 && rest < 560 && Math.abs(rest % 610) > 5, { rest, path });
  }
`);

// Real wheel input: settle eases a short trackpad scroll back onto its slide; none leaves it put.
await inPage(`S.settle.goTo(0, { instant: true }); S.free.goTo(0, { instant: true });`);
await sleep(300);
await wheel("settle", 200);
const wheelSettle = await inPage(`${snapHelpers}
  const path = await frames("settle", 900); await settled("settle");
  check("settle.wheelScrollsFreely", Math.max(...path) > 120, { peak: Math.max(...path) });
  check("settle.wheelEasesBack", near(track("settle").scrollLeft, 0) && S.settle.currentIndex === 0, { pos: track("settle").scrollLeft, path });
`);
await wheel("free", 200);
const wheelNone = await inPage(`${snapHelpers}
  await settled("free"); await sleep(300);
  const pos = track("free").scrollLeft;
  check("none.wheelRests", pos > 120 && pos < 260, { pos });
`);

// An eased scroll already running when reduced motion turns on lands at once.
await inPage(`S.longEase.goTo(4); await sleep(150);`);
await setReducedMotion("reduce");
const reduced = await inPage(`
  await sleep(50);
  { const t = track("longEase"); check("reduced.stopsEaseInFlight", near(t.scrollLeft, t.scrollWidth - t.clientWidth), { pos: t.scrollLeft }); }
  S.basic.goTo(0); await sleep(600);
  S.basic.goTo(1);
  check("reduced.scrollIsInstant", near(track("basic").scrollLeft, 610), { pos: track("basic").scrollLeft });
  S.eased.goTo(0);
  check("reduced.easedIsInstant", near(track("eased").scrollLeft, 0), { pos: track("eased").scrollLeft });
  const at = S.ticking.currentIndex; await sleep(700);
  check("reduced.autoplayStops", S.ticking.currentIndex === at, { at, now: S.ticking.currentIndex });
`);
await setReducedMotion("no-preference");
const restored = await inPage(`
  const at = S.ticking.currentIndex; await sleep(500);
  check("reduced.autoplayResumes", S.ticking.currentIndex !== at, { at, now: S.ticking.currentIndex });
`);
ws.close();
chrome.kill();
server.stop();

const failures: string[] = [
  ...(result.result?.value ?? [`evaluate failed: ${JSON.stringify(result)}`]),
  ...touched,
  ...snapped,
  ...wheelSettle,
  ...wheelNone,
  ...reduced,
  ...restored,
  ...errors.map((e) => "page error: " + e),
];
if (failures.length) {
  console.error("FAIL\n" + failures.join("\n"));
  process.exit(1);
}
console.log("ok: slider smoke test passed");

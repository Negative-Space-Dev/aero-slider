// Draws the docs site's social card (og:image): the hero line over an enlarged
// Benefits sheet. Writes site/public/og-image.svg, with the site's fonts
// embedded so it renders the same anywhere, and og-image.png from it at
// 1200x630, which is what X, Slack and the rest read.
//
// `bun run og-image` builds dist/ first, so the size figures are current. It
// runs under Node, whose gzip the site's own figures use; Bun's differs.

import { chromium } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

const W = 1200;
const H = 630;
const out = "site/public/og-image";

// ── Figures the card states ─────────────────────────────────────────────
// Level 6 is Node's default, which the site's own figures (site/src/lib/bundle-size.ts) use.
const gzipKB = (path: string) => gzipSync(readFileSync(path, "utf8"), { level: 6 }).length / 1000;
const js = gzipKB("dist/aero-slider.min.js");
const css = gzipKB("dist/aero-slider.min.css");
const total = js + css;
const kb = (value: number) => value.toFixed(1);
const version: string = JSON.parse(readFileSync("package.json", "utf8")).version;

const font = (name: string, file: string) => {
  const data = readFileSync(`site/node_modules/@fontsource-variable/${file}`).toString("base64");
  return `@font-face{font-family:"${name}";font-weight:100 900;src:url(data:font/woff2;base64,${data}) format("woff2");}`;
};

// ── Palette: the site's tokens (site/src/styles/global.css) ─────────────
const c = {
  paper: "#08090a",
  surface: "#15171b",
  ink: "#eceef1",
  muted: "#a4aab3",
  faint: "#7c828b",
  line: "#1b1d21",
  lineStrong: "#2d3036",
  accent: "#6aa5ff",
};

// ── Benefits drawings, as Benefits.astro draws them (320 x 146 units) ───
function cssFirstFigure(): string {
  const viewports = [
    { x: 4, width: 48, label: "390", slides: 1 },
    { x: 66, width: 92, label: "768", slides: 2 },
    { x: 172, width: 144, label: "1280", slides: 3 },
  ];
  const frames = viewports.map((f) => {
    const inner = f.width - 10;
    const sw = (inner - 4 * (f.slides - 1)) / f.slides;
    const center = f.x + f.width / 2;
    const slides = Array.from(
      { length: f.slides },
      (_, i) =>
        `<rect class="strong" x="${f.x + 5 + i * (sw + 4) + 0.5}" y="55.5" width="${sw - 1}" height="43" rx="1.5"/>`
    ).join("");
    return `<path class="strong" d="M${center} 20.5V27"/>
      <text x="${center}" y="40" text-anchor="middle" class="value">${f.slides}</text>
      <rect class="faint" x="${f.x + 0.5}" y="50.5" width="${f.width - 1}" height="53" rx="3"/>
      ${slides}
      <path class="strong" d="M${f.x + 0.5} 114V122M${f.x + f.width - 0.5} 114V122M${f.x + 0.5} 118.5H${f.x + f.width - 0.5}"/>
      <text x="${center}" y="136" text-anchor="middle">${f.label}</text>`;
  });
  return `<text x="4" y="12" class="accent-text">--aero-slides-per-view</text>
    <path class="strong" d="M4 20.5H316"/>${frames.join("")}`;
}

function nativeScrollFigure(): string {
  const xs = [-36, 28, 92, 156, 220, 284];
  const inFrame = (x: number) => x >= 86 && x + 56 <= 218;
  const slides = xs
    .map((x) =>
      inFrame(x)
        ? `<rect class="faint" x="${x + 0.5}" y="54.5" width="55" height="45" rx="1.5"/>`
        : `<rect class="strong dashed" x="${x + 0.5}" y="54.5" width="55" height="45" rx="1.5"/>`
    )
    .join("");
  const ticks = xs
    .map((x) => `<path class="${inFrame(x) ? "faint" : "strong"}" d="M${x + 28.5} 116V125"/>`)
    .join("");
  return `<text x="86" y="34">viewport</text>
    <path class="accent" d="M168 30.5H220M215 26.5L220 30.5L215 34.5"/>
    ${slides}
    <rect class="muted" x="86.5" y="46.5" width="131" height="61" rx="3"/>
    <path class="strong" d="M0 120.5H320"/>${ticks}
    <text x="4" y="138">snap points</text>
    <text x="316" y="138" text-anchor="end">track</text>`;
}

function sizeFigure(): string {
  const barX = 12;
  const unit = Math.min(36, 300 / total);
  const jsW = js * unit;
  const cssW = css * unit;
  const end = barX + jsW + cssW;
  const mid = (barX + end) / 2;
  return `<defs>
      <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="strong" d="M0 0V5"/></pattern>
      <pattern id="hatch-dense" width="2.5" height="2.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="faint" d="M0 0V2.5"/></pattern>
    </defs>
    <text x="${barX}" y="40">js ${kb(js)} KB</text>
    <text x="${end}" y="40" text-anchor="end">css ${kb(css)} KB</text>
    <path class="strong" d="M${barX + 0.5} 44V50M${end - 0.5} 44V50"/>
    <rect x="${barX + 0.5}" y="52.5" width="${jsW}" height="22" fill="url(#hatch)"/>
    <rect x="${barX + jsW + 0.5}" y="52.5" width="${cssW - 1}" height="22" fill="url(#hatch-dense)"/>
    <rect class="faint" x="${barX + 0.5}" y="52.5" width="${jsW + cssW - 1}" height="22" rx="1"/>
    <path class="faint" d="M${barX + jsW + 0.5} 52.5V74.5"/>
    <path class="accent" d="M${barX + 0.5} 82V94M${end - 0.5} 82V94M${barX + 0.5} 88.5H${mid - 40}M${mid + 40} 88.5H${end - 0.5}"/>
    <text x="${mid}" y="92" text-anchor="middle" class="accent-text">${kb(total)} KB gzip</text>
    <path class="strong" d="M${barX + 0.5} 120V128M${barX + unit + 0.5} 120V128M${barX + 0.5} 124.5H${barX + unit + 0.5}"/>
    <text x="${barX + unit + 8}" y="128">1 KB</text>
    <text x="${end}" y="128" text-anchor="end" class="value">0 dependencies</text>`;
}

// ── Layout ──────────────────────────────────────────────────────────────
const margin = 60;
const sheet = { x: margin, y: 300, w: W - margin * 2, h: 270 };
const cellW = sheet.w / 3;
const pad = 30;
const figW = cellW - pad * 2;
const figH = (figW / 320) * 146;

const cells = [
  { title: "CSS-first", figure: cssFirstFigure() },
  { title: "Native scroll", figure: nativeScrollFigure() },
  { title: `${kb(total)} KB gzipped`, figure: sizeFigure() },
]
  .map((cell, i) => {
    const x = sheet.x + i * cellW;
    return `<text class="cell-title" x="${x + pad}" y="${sheet.y + 56}">${cell.title}</text>
      <svg class="fig" x="${x + pad}" y="${sheet.y + sheet.h - pad - figH + 6}" width="${figW}" height="${figH}" viewBox="0 0 320 146">${cell.figure}</svg>`;
  })
  .join("");

const dividers = [1, 2]
  .map(
    (i) => `<path class="sheet-line" d="M${sheet.x + i * cellW} ${sheet.y}V${sheet.y + sheet.h}"/>`
  )
  .join("");

// Registration marks wherever the sheet's hairlines meet its edges.
const markXs = [0, 1, 2, 3].map((i) => sheet.x + i * cellW);
const marks = markXs
  .flatMap((x) => [sheet.y, sheet.y + sheet.h].map((y) => `<use href="#mark" x="${x}" y="${y}"/>`))
  .join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <title>Aero Slider: CSS-first slider for the modern web</title>
  <style>
    ${font("Sora", "sora/files/sora-latin-wght-normal.woff2")}
    ${font("Manrope", "manrope/files/manrope-latin-wght-normal.woff2")}
    ${font("Geist Mono", "geist-mono/files/geist-mono-latin-wght-normal.woff2")}
    .headline { font: 500 72px Sora; letter-spacing: -1.44px; fill: ${c.ink}; }
    .name { font: 500 28px Manrope; letter-spacing: -0.2px; fill: ${c.ink}; }
    .mono { font: 400 18px "Geist Mono"; letter-spacing: 0.2px; fill: ${c.faint}; }
    .cell-title { font: 500 32px Sora; letter-spacing: -0.64px; fill: ${c.ink}; }
    .sheet-line { stroke: ${c.lineStrong}; stroke-width: 1; fill: none; }
    /* Heavier and one step lighter than on the site: the card is mostly seen at
       about half size, where the site's hairlines disappear. */
    .fig path, .fig rect { stroke-width: 1.5; }
    .fig :is(path, rect):not([fill]) { fill: none; }
    .fig .strong { stroke: #41454d; }
    .fig .faint { stroke: ${c.faint}; }
    .fig .muted { stroke: ${c.muted}; }
    .fig .accent { stroke: ${c.accent}; }
    .fig .dashed { stroke-dasharray: 3 3; }
    .fig text { font: 400 10px "Geist Mono"; letter-spacing: 0.1px; fill: ${c.faint}; }
    .fig .value { fill: ${c.ink}; }
    .fig .accent-text { fill: ${c.accent}; }
  </style>
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse" x="${sheet.x - 1}" y="${sheet.y - 1}">
      <path d="M0 0.5H24M0.5 0V24" stroke="${c.line}" stroke-opacity="0.75" fill="none"/>
    </pattern>
    <g id="mark" transform="translate(-10 -10)">
      <path d="M10 0V20M0 10H20" stroke="${c.faint}" stroke-width="1"/>
      <circle cx="10" cy="10" r="4.5" fill="${c.paper}" stroke="${c.faint}" stroke-width="1"/>
    </g>
  </defs>

  <rect width="${W}" height="${H}" fill="${c.paper}"/>

  <!-- Header: logo, name and version; the address on the right -->
  <g transform="translate(${margin} 40) scale(1.25)">
    <rect x="1" y="10" width="6" height="12" rx="2" fill="${c.ink}" opacity="0.35"/>
    <rect x="10" y="5" width="12" height="22" rx="3" fill="${c.accent}"/>
    <rect x="25" y="10" width="6" height="12" rx="2" fill="${c.ink}" opacity="0.35"/>
  </g>
  <text id="name" class="name" x="${margin + 54}" y="70">Aero Slider</text>
  <g id="version">
    <rect id="version-box" y="44" height="34" rx="17" fill="${c.surface}" stroke="${c.lineStrong}"/>
    <text id="version-text" class="mono" y="67" style="font-size:16px">v${version}</text>
  </g>
  <text class="mono" x="${W - margin}" y="67" text-anchor="end">aeroslider.com</text>

  <!-- Hero line -->
  <text class="headline" x="${W / 2}" y="180" text-anchor="middle">CSS-first slider for</text>
  <text class="headline" x="${W / 2}" y="256" text-anchor="middle">the modern web</text>

  <!-- Benefits sheet -->
  <rect x="${sheet.x}" y="${sheet.y}" width="${sheet.w}" height="${sheet.h}" fill="url(#grid)"/>
  <rect class="sheet-line" x="${sheet.x + 0.5}" y="${sheet.y + 0.5}" width="${sheet.w - 1}" height="${sheet.h - 1}"/>
  ${dividers}
  ${cells}
  ${marks}
</svg>`;

// Lay out what depends on measured text, then keep that SVG as the source.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><body style="margin:0;background:${c.paper}">${svg}</body>`);
await page.evaluate(() => document.fonts.ready);
const finalSvg = await page.evaluate(() => {
  const name = document.getElementById("name") as unknown as SVGTextElement;
  const text = document.getElementById("version-text") as unknown as SVGTextElement;
  const box = document.getElementById("version-box")!;
  const x = name.getBBox().x + name.getBBox().width + 16;
  const width = text.getComputedTextLength() + 28;
  box.setAttribute("x", String(x + 0.5));
  box.setAttribute("width", String(width));
  text.setAttribute("x", String(x + 14));
  return document.querySelector("body > svg")!.outerHTML;
});
writeFileSync(`${out}.svg`, finalSvg + "\n");
await page.locator("body > svg").screenshot({ path: `${out}.png` });
await browser.close();
console.log(`${out}.svg and ${out}.png: ${kb(total)} KB, v${version}`);

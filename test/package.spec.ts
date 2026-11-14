import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { type Page, expect, test } from "./fixtures.ts";

const BLANK_PATH = "/__package.html";

async function blankPage(page: Page): Promise<void> {
  await page.route(BLANK_PATH, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>package</title>" })
  );
  await page.goto(BLANK_PATH);
}

test("the CDN file sets window.AeroSlider with both functions", async ({ page }) => {
  await blankPage(page);
  await page.addScriptTag({ url: "/dist/aero-slider.min.js", type: "module" });
  await page.waitForFunction(() => window.AeroSlider !== undefined);
  expect(
    await page.evaluate(() => ({
      createSlider: typeof window.AeroSlider?.createSlider,
      syncThumbnails: typeof window.AeroSlider?.syncThumbnails,
    }))
  ).toEqual({ createSlider: "function", syncThumbnails: "function" });
});

// A CDN URL with no file path, unpkg.com/aero-slider, is resolved from package.json. It has to
// reach the file that sets the global, as it did when that file was the package's main entry.
test("a CDN URL with no file path resolves to the file that sets the global", () => {
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  const conditions = Object.keys(manifest.exports["."]);
  expect({
    unpkg: manifest.unpkg,
    jsdelivr: manifest.jsdelivr,
    condition: manifest.exports["."].unpkg,
  }).toEqual({
    unpkg: "./dist/aero-slider.min.js",
    jsdelivr: "./dist/aero-slider.min.js",
    condition: "./dist/aero-slider.min.js",
  });
  // The first matching condition wins, and every resolver matches `import` and `default`.
  expect(conditions.indexOf("unpkg")).toBeLessThan(conditions.indexOf("import"));
});

const EXPORTS = ["autoplay", "createSlider", "loop", "maxDots", "syncThumbnails", "use"];

test("the bundler entry exports the core and every extension and sets no global", async ({
  page,
}) => {
  await blankPage(page);
  expect(
    await page.evaluate(async () => {
      const entry = await import("/dist/index.js" as string);
      return {
        exports: Object.keys(entry).sort(),
        global: "AeroSlider" in window,
      };
    })
  ).toEqual({ exports: EXPORTS, global: false });
});

test("importing the bundler entry in Node defines no global", () => {
  const url = pathToFileURL("dist/index.js").href;
  const script = `
    const before = new Set(Object.getOwnPropertyNames(globalThis));
    const entry = await import(${JSON.stringify(url)});
    const added = Object.getOwnPropertyNames(globalThis).filter((name) => !before.has(name));
    console.log(JSON.stringify({ exports: Object.keys(entry).sort(), added }));
  `;
  const output = execFileSync("node", ["--input-type=module", "-e", script], { encoding: "utf8" });
  expect(JSON.parse(output)).toEqual({ exports: EXPORTS, added: [] });
});

test("a bundle that imports only createSlider drops the thumbnail sync code", () => {
  const keepsSync = (entry: string) =>
    JSON.parse(execFileSync("bun", ["./scripts/tree-shaking.ts", entry], { encoding: "utf8" }))
      .keepsSync;
  expect(keepsSync("dist/index.js")).toBe(false);
  expect(keepsSync("dist/aero-slider.min.js")).toBe(true);
});

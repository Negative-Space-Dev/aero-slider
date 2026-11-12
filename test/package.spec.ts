import { execFileSync } from "node:child_process";
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

test("the bundler entry exports both functions and sets no global", async ({ page }) => {
  await blankPage(page);
  expect(
    await page.evaluate(async () => {
      const entry = await import("/dist/index.js" as string);
      return {
        exports: Object.keys(entry).sort(),
        global: "AeroSlider" in window,
      };
    })
  ).toEqual({ exports: ["createSlider", "syncThumbnails"], global: false });
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
  expect(JSON.parse(output)).toEqual({ exports: ["createSlider", "syncThumbnails"], added: [] });
});

test("a bundle that imports only createSlider drops the thumbnail sync code", () => {
  const keepsSync = (entry: string) =>
    JSON.parse(execFileSync("bun", ["./scripts/tree-shaking.ts", entry], { encoding: "utf8" }))
      .keepsSync;
  expect(keepsSync("dist/index.js")).toBe(false);
  expect(keepsSync("dist/aero-slider.min.js")).toBe(true);
});

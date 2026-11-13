import type { Page } from "@playwright/test";

declare global {
  interface Window {
    /** Events logged by `recordEvents`, keyed by element id. */
    events: Record<string, string[]>;
  }
}

/** The current index of `window.sliders[id]` and its track's raw scroll offset. */
export const state = (page: Page, id: string) =>
  page.evaluate((id) => {
    const track = document.querySelector<HTMLElement>(`#${id} .aero-slider__track`)!;
    return {
      index: window.sliders[id]!.currentIndex,
      position: Math.round(track.scrollLeft + track.scrollTop),
    };
  }, id);

/**
 * Logs every `aero:*` event that `#id` itself dispatches into `window.events[id]`, as `"name"` or
 * `"name:index"` when the event carries an index. Call it before `create` to see `ready`.
 */
export const recordEvents = (page: Page, id: string) =>
  page.evaluate((id) => {
    const el = document.getElementById(id)!;
    const log: string[] = [];
    (window.events ??= {})[id] = log;
    const names = [
      "ready",
      "slideChange",
      "dragStart",
      "dragEnd",
      "autoplayStart",
      "autoplayStop",
      "destroy",
      "visible",
      "hidden",
    ];
    for (const name of names) {
      el.addEventListener(`aero:${name}`, (event) => {
        if (event.target !== el) return;
        const index = (event as CustomEvent<{ index?: number }>).detail?.index;
        log.push(index === undefined ? name : `${name}:${index}`);
      });
    }
  }, id);

/** The events logged for `#id` so far, then clears the log. */
export const takeEvents = (page: Page, id: string) =>
  page.evaluate((id) => window.events[id]!.splice(0), id);

/**
 * Drags the track of `#id` with the mouse by `dx` pixels from `fromX` (both relative to the
 * track's left edge), one move per animation frame as real input arrives. Back-to-back moves
 * would make the release velocity meaningless.
 */
export async function drag(page: Page, id: string, fromX: number, dx: number): Promise<void> {
  const box = (await page.locator(`#${id} .aero-slider__track`).boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + fromX, y);
  await page.mouse.down();
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(box.x + fromX + (dx * i) / steps, y);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await page.mouse.up();
}

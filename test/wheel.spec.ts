import { type Page, expect, mount, settled, slider, test } from "./fixtures";
import { state } from "./helpers/state";

/** Starts an 800ms linear goTo(3) with the mouse over the slider, and waits 250ms into it. */
async function startLongMove(page: Page) {
  await mount(page, `${slider("s", 5)}<div style="height:2000px"></div>`);
  await page.evaluate(() => {
    window.sliders.s = window.createSlider(document.getElementById("s")!, {
      scrollDuration: 800,
      scrollEasing: (t) => t,
    });
  });
  const box = (await page.locator("#s .aero-slider__track").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(() => window.sliders.s!.goTo(3));
  await page.waitForTimeout(250);
}

test("a vertical wheel over the slider leaves an eased move alone", async ({ page }) => {
  await startLongMove(page);
  await page.mouse.wheel(0, 200);
  await settled(page, "s");
  expect(await state(page, "s")).toEqual({ index: 3, position: 1800 });
});

test("a horizontal wheel over the slider takes over from an eased move", async ({ page }) => {
  await startLongMove(page);
  await page.mouse.wheel(-200, 0);
  await settled(page, "s");
  expect((await state(page, "s")).index).toBeLessThan(3);
});

test("a shift+wheel over the slider takes over from an eased move", async ({ page }) => {
  await startLongMove(page);
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, -200);
  await page.keyboard.up("Shift");
  await settled(page, "s");
  expect((await state(page, "s")).index).toBeLessThan(3);
});

// A native smooth move starts a frame after goTo(), so input can arrive before it does.
for (const input of ["wheel", "press"] as const) {
  test(`a ${input} in the frame goTo() was called in takes over from the move`, async ({
    page,
  }) => {
    await mount(page, slider("s", 5));
    await page.evaluate(() => {
      window.sliders.s = window.createSlider(document.getElementById("s")!);
    });
    await settled(page, "s");
    await page.evaluate((input) => {
      const track = document.querySelector("#s .aero-slider__track")!;
      window.sliders.s!.goTo(3);
      if (input === "wheel") track.dispatchEvent(new WheelEvent("wheel", { deltaX: 1 }));
      else {
        const press = { pointerId: 7, pointerType: "mouse", button: 0, bubbles: true };
        track.dispatchEvent(new PointerEvent("pointerdown", press));
        track.dispatchEvent(new PointerEvent("pointerup", press));
      }
    }, input);
    await page.waitForTimeout(400); // past the settle that follows a wheel or a release
    await settled(page, "s");
    expect(await state(page, "s")).toEqual({ index: 0, position: 0 });
  });
}

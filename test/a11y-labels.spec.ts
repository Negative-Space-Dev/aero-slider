import { create, expect, mount, slider, test } from "./fixtures";

test("labels replace the English strings, and a partial update falls back to the defaults", async ({
  page,
}) => {
  await mount(page, slider("s", 3));
  const root = page.locator("#s");
  const firstDot = page.locator("#s .aero-slider__dot").first();

  await create(page, "s", {
    labels: { carousel: "Karussell", dot: "Zu Folie {index} von {count}" },
  });
  await expect(root).toHaveAttribute("aria-roledescription", "Karussell");
  await expect(firstDot).toHaveAttribute("aria-label", "Zu Folie 1 von 3");

  await page.evaluate(() => window.sliders.s!.update({ labels: { dot: "Folie {index}" } }));
  await expect(root).toHaveAttribute("aria-roledescription", "carousel");
  await expect(firstDot).toHaveAttribute("aria-label", "Folie 1");

  await page.evaluate(() => window.sliders.s!.update({ perMove: 1 }));
  await expect(firstDot).toHaveAttribute("aria-label", "Folie 1");
});

test("unknown keys and values that are not strings are ignored", async ({ page }) => {
  await mount(page, slider("s", 3));
  await page.evaluate(() => {
    window.sliders.s = window.createSlider(document.getElementById("s")!, {
      labels: { carousel: 42, dot: null, nonsense: "x" } as never,
    });
  });
  await expect(page.locator("#s")).toHaveAttribute("aria-roledescription", "carousel");
  await expect(page.locator("#s .aero-slider__dot").first()).toHaveAttribute(
    "aria-label",
    "Go to slide 1"
  );
});

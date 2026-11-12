import { createSlider, syncThumbnails } from "aero-slider";
import type { SliderConfig } from "aero-slider";
import { getRequiredElementById } from "../lib/dom";
import { createSlideElement } from "../lib/slide";

// Deferred so the playground paints first.
requestAnimationFrame(() => {
  createSlider(getRequiredElementById<HTMLElement>("multi"));
  const breakoutSlider = createSlider(getRequiredElementById<HTMLElement>("breakout-bleed"), {
    alignment: "left",
  });

  const breakoutAlign = document.getElementById("breakout-align");
  if (breakoutAlign) {
    const alignButtons = breakoutAlign.querySelectorAll<HTMLButtonElement>("button[data-align]");
    const setActiveAlign = (value: string) => {
      for (const btn of alignButtons) {
        btn.toggleAttribute("data-active", btn.dataset.align === value);
      }
    };
    setActiveAlign("left");
    breakoutAlign.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-align]");
      const value = btn?.dataset.align as SliderConfig["alignment"] | undefined;
      if (!value) return;
      breakoutSlider.update({ alignment: value });
      setActiveAlign(value);
    });
  }
  createSlider(getRequiredElementById<HTMLElement>("alignment-left"), {
    alignment: "left",
    loop: true,
  });
  createSlider(getRequiredElementById<HTMLElement>("alignment-center"), {
    alignment: "center",
    loop: true,
  });
  createSlider(getRequiredElementById<HTMLElement>("alignment-right"), {
    alignment: "right",
    loop: true,
  });
  createSlider(getRequiredElementById<HTMLElement>("autoplay"), {
    autoplay: true,
    autoplayInterval: 3000,
    loop: true,
  });
  createSlider(getRequiredElementById<HTMLElement>("responsive"));

  const thumbMain = createSlider(getRequiredElementById<HTMLElement>("thumbnail-main"));
  const thumbThumbs = createSlider(getRequiredElementById<HTMLElement>("thumbnail-thumbs"), {
    alignment: "center",
  });
  syncThumbnails(thumbMain, thumbThumbs);

  createSlider(getRequiredElementById<HTMLElement>("direction-rtl"), { direction: "rtl" });
  createSlider(getRequiredElementById<HTMLElement>("direction-vertical"), { direction: "ttb" });

  const dynamicSlider = createSlider(getRequiredElementById<HTMLElement>("dynamic-slides"));
  let dynamicCount = 3;
  getRequiredElementById("dynamic-add").addEventListener("click", () => {
    dynamicCount++;
    dynamicSlider.add(createSlideElement({ num: dynamicCount }, dynamicCount));
  });
  getRequiredElementById("dynamic-remove").addEventListener("click", () => {
    if (dynamicSlider.slideCount > 1) {
      dynamicSlider.remove(dynamicSlider.slideCount - 1);
      dynamicCount = dynamicSlider.slideCount;
    }
  });

  createSlider(getRequiredElementById<HTMLElement>("per-move"), { perMove: 2, loop: true });
  createSlider(getRequiredElementById<HTMLElement>("snap-settle"), {
    loop: true,
    snap: "settle",
    scrollDuration: 550,
  });
  createSlider(getRequiredElementById<HTMLElement>("snap-none"), { snap: "none" });
  createSlider(getRequiredElementById<HTMLElement>("continuous"), {
    autoplay: "continuous",
    autoplaySpeed: 36,
    draggable: false,
  });
  createSlider(getRequiredElementById<HTMLElement>("pagination-minimal"));
  createSlider(getRequiredElementById<HTMLElement>("nav-minimal"));
});

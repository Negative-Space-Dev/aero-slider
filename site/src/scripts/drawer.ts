// The phone menu behaves like an iOS sheet: it follows the finger one to one,
// rubber-bands when pulled past its resting place, hands a downward pull over
// from the scrolled-to-top content to the sheet, and settles or dismisses on
// release with a spring that carries the finger's velocity.

const drawer = document.querySelector<HTMLDialogElement>("#site-drawer");
const sheet = drawer?.querySelector<HTMLElement>(".drawer__sheet");
const head = drawer?.querySelector<HTMLElement>(".drawer__head");
const body = drawer?.querySelector<HTMLElement>(".drawer__body");
if (drawer && sheet && head && body) setUp(drawer, sheet, head, body);

/** UIKit's rubber-band curve: resistance grows with the distance pulled. */
const rubberBand = (distance: number, dimension: number): number =>
  (1 - 1 / ((distance * 0.55) / dimension + 1)) * dimension;

// A critically damped spring: no overshoot, and it starts from any velocity.
const SPRING = (2 * Math.PI) / 0.4;
const FLICK = 0.5; // px per ms that dismisses whatever the distance

interface Drag {
  startY: number;
  /** Finger position that maps to the sheet's resting place. */
  anchorY: number;
  active: boolean;
  fromBody: boolean;
  travel: number;
  samples: { time: number; y: number }[];
}

function setUp(
  drawer: HTMLDialogElement,
  sheet: HTMLElement,
  head: HTMLElement,
  body: HTMLElement
): void {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let offset = 0; // px below the resting place
  let frame = 0;
  let closing = false;
  let drag: Drag | null = null;
  let dragged = false;

  const height = () => sheet.offsetHeight;

  function place(y: number): void {
    offset = y;
    sheet.style.transform = `translate3d(0, ${y}px, 0)`;
    drawer.style.setProperty("--drawer-dim", String(Math.min(1, Math.max(0, 1 - y / height()))));
  }

  /** `velocity` is in px per second, positive downwards. */
  function springTo(target: number, velocity: number, done?: () => void): void {
    cancelAnimationFrame(frame);
    if (reducedMotion.matches) {
      place(target);
      done?.();
      return;
    }
    const from = offset - target;
    const slope = velocity + SPRING * from;
    const start = performance.now();
    const step = (now: number): void => {
      const t = (now - start) / 1000;
      const x = (from + slope * t) * Math.exp(-SPRING * t);
      if ((t > 0.08 && Math.abs(x) < 0.5) || t > 1) {
        place(target);
        done?.();
        return;
      }
      place(target + x);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  function open(): void {
    closing = false;
    drawer.showModal();
    drawer.scrollTop = 0;
    body.scrollTop = 0;
    place(height());
    springTo(0, 0);
  }

  function close(velocity = 0): void {
    if (closing || !drawer.open) return;
    closing = true;
    // A drag still held would spring the sheet back on release and cancel this dismissal.
    drag = null;
    body.style.overflowY = "";
    springTo(height() + 24, velocity, () => drawer.close());
  }

  document.querySelector("[data-drawer-open]")?.addEventListener("click", open);
  drawer.addEventListener("close", () => {
    cancelAnimationFrame(frame);
    closing = false;
  });
  // Escape would close it at once; slide it away instead.
  drawer.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  drawer.addEventListener("click", (event) => {
    if (dragged) {
      dragged = false;
      event.preventDefault();
      return;
    }
    if ((event.target as Element).closest("a, [data-drawer-close]")) close();
  });
  matchMedia("(min-width: 640px)").addEventListener("change", (event) => {
    if (event.matches && drawer.open) drawer.close();
  });

  function begin(y: number, fromBody: boolean): void {
    dragged = false;
    if (closing) return;
    drag = {
      startY: y,
      anchorY: 0,
      active: false,
      fromBody,
      travel: 0,
      samples: [{ time: performance.now(), y }],
    };
  }

  /** Returns true when the sheet, not the content, took the move. */
  function move(y: number): boolean {
    if (!drag) return false;
    const now = performance.now();
    const last = drag.samples[drag.samples.length - 1];
    drag.travel += Math.abs(y - last.y);
    drag.samples.push({ time: now, y });
    while (drag.samples.length > 2 && now - drag.samples[0].time > 100) drag.samples.shift();

    if (!drag.active) {
      const delta = y - drag.startY;
      const pullsDown = delta > 0 && (!drag.fromBody || body.scrollTop <= 0);
      const pullsUp = delta < 0 && !drag.fromBody;
      if (!pullsDown && !pullsUp) {
        // The content is scrolling. Re-arm from here so a later pull at the
        // top of the content picks the sheet up without a jump.
        drag.startY = y;
        return false;
      }
      cancelAnimationFrame(frame);
      drag.active = true;
      drag.anchorY = drag.startY - offset;
      body.style.overflowY = "hidden";
    }

    const pulled = y - drag.anchorY;
    if (pulled < 0 && drag.fromBody) {
      place(0);
      drag.active = false;
      drag.startY = y;
      body.style.overflowY = "";
      return true;
    }
    place(pulled >= 0 ? pulled : -rubberBand(-pulled, height()));
    return true;
  }

  function end(): void {
    if (!drag) return;
    const { active, travel, samples } = drag;
    drag = null;
    body.style.overflowY = "";
    dragged = travel > 8;
    if (!active) return;

    const first = samples[0];
    const last = samples[samples.length - 1];
    const fresh = performance.now() - last.time < 80 && last.time > first.time;
    const velocity = fresh ? (last.y - first.y) / (last.time - first.time) : 0;
    const dismiss = velocity > FLICK || (velocity > -0.2 && offset + velocity * 180 > height() / 2);
    if (dismiss) close(velocity * 1000);
    else springTo(0, velocity * 1000);
  }

  sheet.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length === 1)
        begin(event.touches[0].clientY, body.contains(event.target as Node));
    },
    { passive: true }
  );
  sheet.addEventListener(
    "touchmove",
    (event) => {
      if (move(event.touches[0].clientY) && event.cancelable) event.preventDefault();
    },
    { passive: false }
  );
  sheet.addEventListener("touchend", end);
  sheet.addEventListener("touchcancel", end);

  // A mouse drags it by the header, for narrow desktop windows.
  head.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    begin(event.clientY, false);
    const onMove = (moveEvent: PointerEvent): void => void move(moveEvent.clientY);
    const onUp = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      end();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });
}

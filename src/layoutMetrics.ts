const layoutProbes = new WeakMap<HTMLElement, HTMLDivElement>();

function getLayoutProbe(element: HTMLElement): HTMLDivElement {
  let probe = layoutProbes.get(element);
  if (!probe) {
    probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;visibility:hidden;pointer-events:none;height:0;padding:0;margin:0;border:0;top:0;left:0;";
    element.appendChild(probe);
    layoutProbes.set(element, probe);
  }
  return probe;
}

/** Remove the persistent layout probe created for a slider container. */
export function releaseLayoutProbe(element: HTMLElement): void {
  layoutProbes.get(element)?.remove();
  layoutProbes.delete(element);
}

/**
 * Resolve a CSS length to pixels. Handles common units without DOM measurement;
 * falls back to a reused off-screen probe for calc()/min()/max().
 */
export function resolveCssLength(
  value: string,
  element: HTMLElement,
  percentReferencePx: number
): number {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0" || trimmed === "0px") return 0;

  const pxMatch = trimmed.match(/^(-?[\d.]+)px$/);
  if (pxMatch) return parseFloat(pxMatch[1]!);

  const remMatch = trimmed.match(/^(-?[\d.]+)rem$/);
  if (remMatch) {
    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return parseFloat(remMatch[1]!) * rootSize;
  }

  if (trimmed.endsWith("%")) {
    const pct = parseFloat(trimmed);
    return Number.isFinite(pct) ? (pct / 100) * percentReferencePx : 0;
  }

  const probe = getLayoutProbe(element);
  probe.style.width = trimmed;
  const measured = probe.offsetWidth;
  probe.style.width = "";
  return measured || 0;
}

/**
 * Compute slide scroll stride (visual slide size + gap) from CSS variables.
 * Matches flex-basis in slider.css without measuring slide elements.
 *
 * `useLayoutWidthVar` mirrors the CSS: the horizontal flex-basis is derived from
 * `--aero-layout-width`, but the vertical rule hard-codes `100%`, so vertical
 * sliders must resolve against the reference size and ignore the variable.
 */
export function measureSlideStride(
  container: HTMLElement,
  styles: CSSStyleDeclaration,
  referenceSizePx: number,
  slidesPerView: number,
  gapPx: number,
  useLayoutWidthVar = true
): number {
  if (referenceSizePx <= 0 || slidesPerView <= 0) return 0;

  let layoutWidth = referenceSizePx;
  if (useLayoutWidthVar) {
    const layoutWidthValue = styles.getPropertyValue("--aero-layout-width").trim() || "100%";
    layoutWidth =
      layoutWidthValue === "100%" || layoutWidthValue === "100vw"
        ? referenceSizePx
        : resolveCssLength(layoutWidthValue, container, referenceSizePx);
  }

  const slideVisual = (layoutWidth - gapPx * (slidesPerView - 1)) / slidesPerView;
  return slideVisual > 0 ? slideVisual + gapPx : 0;
}

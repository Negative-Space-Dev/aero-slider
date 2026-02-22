/**
 * Monitors CSS variables on an element for changes caused by media queries.
 * Uses window.resize (the only reliable way to catch media query shifts) with a
 * hybrid debounce + maxWait to balance performance and responsiveness.
 *
 * @param element - Element whose computed CSS to watch (e.g. slider container)
 * @param variableNames - CSS custom property names to monitor
 * @param onChange - Called when any variable value has changed
 * @param options - debounceMs: wait after last resize (default 100); maxWaitMs: force run interval (default 250)
 * @returns Teardown function to remove the listener
 */
export function monitorCssVariables(
  element: HTMLElement,
  variableNames: string[],
  onChange: () => void,
  options: { debounceMs?: number; maxWaitMs?: number } = {}
): () => void {
  const debounceMs = options.debounceMs ?? 100;
  const maxWaitMs = options.maxWaitMs ?? 250;

  let lastKnownValue = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let firstResizeTime: number | null = null;

  function getState(): string {
    const styles = getComputedStyle(element);
    return variableNames.map((name) => styles.getPropertyValue(name).trim()).join("\0");
  }

  function flush(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    firstResizeTime = null;

    const current = getState();
    if (current !== lastKnownValue) {
      lastKnownValue = current;
      onChange();
    }
  }

  function onResize(): void {
    const now = Date.now();
    if (firstResizeTime === null) firstResizeTime = now;

    const elapsed = now - firstResizeTime;
    const shouldForce = elapsed >= maxWaitMs;

    if (shouldForce) {
      flush();
      return;
    }

    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, debounceMs);
  }

  lastKnownValue = getState();
  window.addEventListener("resize", onResize);

  return () => {
    window.removeEventListener("resize", onResize);
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}

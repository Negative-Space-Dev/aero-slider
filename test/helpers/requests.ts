import type { Page } from "@playwright/test";

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

/**
 * Answers every request under `/img/` with a 1px PNG and returns a function that lists the
 * requested URLs so far, one entry per request.
 */
export async function imageRequests(page: Page): Promise<() => string[]> {
  const urls: string[] = [];
  await page.route("**/img/**", (route) => {
    urls.push(new URL(route.request().url()).pathname);
    return route.fulfill({ contentType: "image/png", body: PIXEL });
  });
  return () => [...urls];
}

/** Ids of the example entries, so other sections can link to them by a checked name. */
export const exampleIds = [
  "ex-variants",
  "ex-edge-to-edge",
  "ex-mobile-only",
  "ex-autoplay",
  "ex-ticker",
  "ex-announcement",
  "ex-gallery",
  "ex-product-row",
  "ex-max-dots",
  "ex-counter",
  "ex-styling",
] as const;

export type ExampleId = (typeof exampleIds)[number];

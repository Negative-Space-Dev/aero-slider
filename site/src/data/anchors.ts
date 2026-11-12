/** Ids of the example entries, so other sections can link to them by a checked name. */
export const exampleIds = [
  "ex-card-row",
  "ex-responsive",
  "ex-alignment",
  "ex-edge-to-edge",
  "ex-direction",
  "ex-no-shift",
  "ex-autoplay",
  "ex-ticker",
  "ex-snap",
  "ex-per-move",
  "ex-arrows-dots",
  "ex-max-dots",
  "ex-gallery",
  "ex-no-drag",
  "ex-styling",
] as const;

export type ExampleId = (typeof exampleIds)[number];

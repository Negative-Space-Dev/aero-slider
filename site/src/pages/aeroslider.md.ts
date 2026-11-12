// The agent guide from the repo root, served as written at /aeroslider.md.
import guide from "../../../aeroslider.md?raw";

export const GET = () =>
  new Response(guide, { headers: { "Content-Type": "text/plain; charset=utf-8" } });

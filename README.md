# Aero Slider

A lightweight, CSS-first slider library for the modern web.

**Documentation:** [aeroslider.com](https://aeroslider.com)

## Installation

```bash
bun add aero-slider
```

Or with npm:

```bash
npm install aero-slider
```

Then import the package and styles:

```js
import { createSlider } from "aero-slider";
import "aero-slider/slider.css";
```

## Project setup

To install dependencies for this repo:

```bash
bun install
```

## Working on the site

The documentation site lives in `site/` (Astro + Tailwind). Useful commands:

- **`bun run site:dev`** — Start the dev server for the doc site
- **`bun run site:build`** — Build the doc site for production

## Deploying to Cloudflare Pages

Use the Git integration: connect your repo, then set:

- **Build command:** `bun run site:build`
- **Build output directory:** `site/dist`

**Bun version:** Cloudflare’s default Bun (1.2.15) may differ from your local version. To match or use the latest:

1. In Cloudflare Dashboard → your Pages project → **Settings** → **Builds & deployments** → **Build configuration**
2. Add an environment variable: `BUN_VERSION` = `1.3.9` (to match local) or `latest`

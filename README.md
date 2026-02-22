# Aero Slider

A lightweight (~6KB), CSS-first slider library for the modern web.

- **CSS-First Architecture** — Layout via custom properties, responsive via media queries
- **Native Scroll Snapping** — Hardware-accelerated, smooth scrolling
- **Minimal JS Footprint** — Only handles events, loop cloning, pagination, autoplay
- **Zero Dependencies** — No external libraries required
- **Thumbnail Syncing** — Link primary sliders with thumbnail navigation
- **iOS-Style Pagination** — Optional `maxDots` for windowed dot navigation

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

## Publishing

### Publishing to npm

1. **Log in to npm** (if not already):
   ```bash
   npm login
   ```

2. **Bump the version** in `package.json`:
   - Patch: `npm version patch` (e.g. 1.0.0 → 1.0.1)
   - Minor: `npm version minor` (e.g. 1.0.0 → 1.1.0)
   - Prerelease: `npm version prerelease --preid=beta` (e.g. 1.0.0 → 1.0.1-beta.0)

3. **Run checks**:
   ```bash
   bun run build
   bun run typecheck
   bun run pack
   ```
   `pack` creates a `.tgz` so you can verify what gets published.

4. **Publish**:
   - **Stable** (e.g. 1.0.0): `npm publish`
   - **Prerelease** (e.g. 1.0.0-beta.0): `npm publish --tag beta`

   Prereleases require `--tag` so they don’t become the default for `npm install aero-slider`. Users install betas with `npm install aero-slider@beta`.

### GitHub Release workflow

When you [create a release](https://github.com/Negative-Space-Dev/aero-slider/releases/new) on GitHub and publish it, the **Release** workflow runs automatically:

1. **Triggers on** `release: types: [published]` — runs when you publish a release (draft releases do not trigger it).
2. **Builds** the slider with `bun run build`.
3. **Creates a zip** containing `aero-slider.js` and `aero-slider.css`.
4. **Uploads** the zip as an asset on the release (e.g. `aero-slider-v1.0.0.zip` for tag `v1.0.0`).

The zip is a standalone distribution for users who prefer downloading over `npm install`.

# Contributing to Aero Slider

This guide covers working on the slider library, the documentation site, and releasing.

## Project setup

To install dependencies:

```bash
bun install
```

## Working on the library

- **`bun run build`** — Build the slider
- **`bun run typecheck`** — Run TypeScript checks
- **`bun run format`** — Format code with Prettier
- **`bun run format:check`** — Check formatting

## Working on the site

The documentation site lives in `site/` (Astro + Tailwind):

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

   Prereleases require `--tag` so they don't become the default for `npm install aero-slider`. Users install betas with `npm install aero-slider@beta`.

5. **Mark Latest**
   - `npm dist-tag add aero-slider@{version} latest`

### GitHub Release workflow

When you [create a release](https://github.com/Negative-Space-Dev/aero-slider/releases/new) on GitHub and publish it, the **Release** workflow runs automatically:

1. **Triggers on** `release: types: [published]` — runs when you publish a release (draft releases do not trigger it).
2. **Builds** the slider with `bun run build`.
3. **Creates a zip** containing `aero-slider.js` and `aero-slider.css`.
4. **Uploads** the zip as an asset on the release (e.g. `aero-slider-v1.0.0.zip` for tag `v1.0.0`).

The zip is a standalone distribution for users who prefer downloading over `npm install`.

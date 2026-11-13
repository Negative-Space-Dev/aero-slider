# Contributing to Aero Slider

This guide covers working on the slider library, the documentation site, and releasing.

## Project setup

To install dependencies:

```bash
bun install
```

## Working on the library

- **`bun run build`** — Build the slider (`build.ts`: bundles JS and CSS with Bun, emits types with `tsc`)
- **`bun run test`** — Build, then run the Playwright tests in `test/*.spec.ts` on Chromium, Firefox and WebKit (first run `bunx playwright install chromium firefox webkit`)
- **`bun run test:ui`** — Build, then open the tests in Playwright's UI mode
- **`bun run size`** — Print the raw and gzipped size of the built JS and CSS, and fail if either is over budget
- **`bun run typecheck`** — Run TypeScript checks on the library, the tests and the build scripts
- **`bun run format`** — Format code with Prettier
- **`bun run format:check`** — Check formatting

To run one spec file on one engine, pass both to Playwright after a build: `bunx playwright test test/navigation.spec.ts --project firefox`. Tests import their helpers from `test/fixtures.ts`. Set `TEST_PORT` when two checkouts run tests at once.

## Working on the site

The documentation site lives in `site/` (Astro + Tailwind):

- **`bun run site:dev`** — Start the dev server for the doc site
- **`bun run site:build`** — Build the doc site for production

## Publishing

Publishing a GitHub release publishes to npm. Nothing is published from a laptop.

1. **Bump the version** in `package.json` on a branch and merge it to `main`:
   - Patch: `npm version patch --no-git-tag-version` (e.g. 1.0.0 → 1.0.1)
   - Minor: `npm version minor --no-git-tag-version` (e.g. 1.0.0 → 1.1.0)
   - Prerelease: `npm version prerelease --preid=beta --no-git-tag-version` (e.g. 1.0.0 → 1.0.1-beta.0)

2. **[Create a release](https://github.com/Negative-Space-Dev/aero-slider/releases/new)** on GitHub from `main`. The tag must be `v` plus the version in `package.json`, such as `v1.0.0`. Tick "Set as a pre-release" for a beta.

3. **Publish the release.** The **Release** workflow runs two jobs:
   - `publish` checks that the tag matches `package.json`, runs the typecheck, size and package checks, and runs `npm publish`. A pre-release goes to the `beta` tag, so it never becomes the default for `npm install aero-slider`. Anything else goes to `latest`.
   - `build-and-zip` attaches `aero-slider-<tag>.zip` (the minified JavaScript and CSS and `aeroslider.md`) and `aeroslider.md` to the release, for people who download instead of installing.

Draft releases do not trigger the workflow.

### One-time npm setup

The workflow signs in to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers), so the repository holds no npm token. On npmjs.com, open the `aero-slider` package settings, add a trusted publisher of type GitHub Actions, and enter the organization `Negative-Space-Dev`, the repository `aero-slider` and the workflow file `release.yml`.

To check a tarball by hand before a release, run `bun run pack`.

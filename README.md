# UnFramer

Export a Framer project as **real React + framer-motion** — from **your own** project, using Framer's **official Server API**, with **no unframer.co and no paywall**. Then preview it, build it to static files, and host it anywhere.

## How it works (and why there's no paywall)

The popular `unframer` package's paid `unframer.co` API only hands back project *metadata* — a map of component name → compiled module URL, plus design tokens/breakpoints/locales. The actual React codegen (`bundle()`) is **open source**.

UnFramer fetches that metadata **itself**, straight from Framer's official Server API (`framer-api`) with **your own project API key**, then feeds it into unframer's open-source `bundle()`. Nothing goes through unframer.co.

```
framer-api.connect(project, YOUR_KEY)      ← official Server API, your credential
   → getNodesWithType('ComponentNode')     → { name, insertURL } per component
   → getColorStyles() / getLocales()       → design tokens, i18n
   → build unframer Config
   → unframer bundle(Config)               ← open source, free
   → ./out/**.jsx + styles.css
```

## Requirements

- Node **≥ 20**
- A Framer plan with **Server API** access (the API-key feature under **Site Settings → General**)

## Setup

```bash
npm install
```

## 1. Get a project API key

Framer project → **Site Settings → General → API key**. It's **scoped to that one project** (not your account password).
Docs: https://www.framer.com/developers/server-api-quick-start

```bash
export FRAMER_API_KEY="fr_xxxxxxxxxxxxxxxxxxxx"   # keep it out of shell history / git
```

## 2. Export

```bash
# Inspect first — dumps the raw SDK shapes (components, color styles, project info):
node export.mjs "<FRAMER_PROJECT_URL_OR_ID>" --inspect

# Export every component:
node export.mjs "<FRAMER_PROJECT_URL_OR_ID>" --out ./out

# Only the homepage's components:
node export.mjs "<FRAMER_PROJECT_URL_OR_ID>" --homepage --out ./out

# Just one component by name (see "whole-page" tip below):
node export.mjs "<FRAMER_PROJECT_URL_OR_ID>" --only "Whole_Page" --out ./page-out
```

### 💡 Best results: export the whole page as one component

Stitching individual sections loses the page-level layout (full-width backgrounds, centering, order). Instead, in Framer **select the whole page → "Create Component"** (e.g. `Whole_Page`), then `--only "Whole_Page"`. You get one component that owns the real desktop composition. Fully reversible in Framer (undo).

## 3. Preview it

```bash
cp viewer/src/App.example.jsx viewer/src/App.jsx    # then point App.jsx at your output
npm run dev                                          # http://localhost:5188
```

`viewer/` is a tiny Vite + React 19 app. Edit `viewer/src/App.jsx` to import your export (the example file shows both the whole-page and stitched-sections patterns). Or auto-generate a stitched, page-ordered `App.jsx`:

```bash
node render-setup.mjs "<FRAMER_PROJECT_URL_OR_ID>" ./out
```

## 4. Ship it — two hosting options

**A. React SPA (full interactivity + motion), as static files — recommended.**

```bash
npm run build          # → viewer/dist/  (index.html + .js + .css, no server)
npm run preview        # sanity-check the build
# deploy viewer/dist anywhere static: Netlify / GitHub Pages / Cloudflare Pages / S3
```

React compiles to plain static assets — it hosts exactly like an HTML file, no Node server. This keeps every Framer animation, hover, and interaction.

**B. Frozen static HTML snapshot (zero JS).**

```bash
npm run static         # → static/index.html  (server-rendered, single self-contained file)
```

Great for a purely visual clone. Trade-off: **no interactivity** (accordions/hovers/video are frozen). The script forces Framer's scroll-appear elements to their final visible state so nothing renders faded.

## Notes & known limits

- **Components only.** A section must be a Framer *component* to have a module URL. Flat frames won't export — componentize them first.
- **Fixed-width desktop.** A Framer breakpoint is a fixed px width (e.g. 1200px). The viewer centers it; auto breakpoint-switching (`.Responsive`) isn't wired yet.
- **Live data** (CMS collections, form submissions) needs a backend — layout/design/motion render, dynamic content won't populate.
- **Assets** (images/fonts) load from `framerusercontent.com`. Download them for a fully self-contained bundle.
- The Server API spins up a **headless Framer session** (~9s cold start on first connect).

### Implementation gotcha (baked into the tool)

`framer-api` installs a global undici HTTP dispatcher that collides with unframer's own during CSS assembly (produces a 0-byte `styles.css`). `export.mjs` therefore **disconnects from framer-api before calling `bundle()`**. Don't reorder that.

---

Built on top of [`unframer`](https://github.com/remorses/unframer) (the open-source exporter) and Framer's [Server API](https://www.framer.com/developers/server-api-quick-start). Use it on projects you own.

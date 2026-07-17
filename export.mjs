#!/usr/bin/env node
// ---------------------------------------------------------------------------
// framer-diy-export — export React components from YOUR Framer project without
// unframer.co (no paywall). Uses Framer's OFFICIAL Server API (framer-api) with
// your own project API key, then hands the data to unframer's OPEN-SOURCE
// bundle() to do the actual React codegen.
//
//   framer-api (read your project)  ->  Config  ->  unframer bundle()  ->  .jsx
//
// Requires: FRAMER_API_KEY env var (Site Settings -> General -> API key).
// Usage:
//   FRAMER_API_KEY=... node export.mjs <projectUrlOrId> --out ./src/framer
//   FRAMER_API_KEY=... node export.mjs <projectUrlOrId> --homepage --out ./out
//   FRAMER_API_KEY=... node export.mjs <projectUrlOrId> --inspect   (diagnostic)
// ---------------------------------------------------------------------------
import { connect } from 'framer-api'
import { bundle } from 'unframer/dist/exporter'
import path from 'node:path'
import process from 'node:process'

// ---- tiny arg parser ------------------------------------------------------
const argv = process.argv.slice(2)
const projectRef = argv.find((a) => !a.startsWith('--'))
const flag = (name) => argv.includes(`--${name}`)
const opt = (name, def) => {
    const i = argv.indexOf(`--${name}`)
    return i !== -1 && argv[i + 1] ? argv[i + 1] : def
}
const OUT = path.resolve(opt('out', './framer-out'))
const HOMEPAGE_ONLY = flag('homepage')
const ONLY = opt('only', null) // export just one component by name (e.g. "Whole_Page")
const INSPECT = flag('inspect')

const apiKey = process.env.FRAMER_API_KEY
if (!projectRef || !apiKey) {
    console.error(
        'Usage: FRAMER_API_KEY=<key> node export.mjs <projectUrlOrId> [--out DIR] [--homepage] [--inspect]',
    )
    process.exit(1)
}

// ---- helpers (reimplemented from unframer so we depend on nothing private) --
const kebab = (s) =>
    String(s || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
// "Nav/Hero Button" -> "nav/hero-button"  (kebab each path segment, keep slashes)
const componentNameToPath = (name) =>
    String(name || 'component-without-name')
        .split('/')
        .map(kebab)
        .filter(Boolean)
        .join('/') || 'component-without-name'
// insertURL carries a trailing @version; unframer strips it before fetching.
const stripVersion = (u) => (u ? String(u).replace(/@[^/@]+$/, '') : u)

// ---------------------------------------------------------------------------
async function main() {
    console.error(`→ connecting to Framer project: ${projectRef}`)
    const framer = await connect(projectRef, apiKey) // ~9s cold start (headless)
    try {
        const projectInfo = await safe(() => framer.getProjectInfo(), {})
        const componentNodes = await safe(
            () => framer.getNodesWithType('ComponentNode'),
            [],
        )
        const colorStyles = await safe(() => framer.getColorStyles(), [])
        const locales = await safe(() => framer.getLocales(), [])
        const webPages = await safe(
            () => framer.getNodesWithType('WebPageNode'),
            [],
        )

        if (INSPECT) return dumpShapes({ projectInfo, componentNodes, colorStyles, locales, webPages })

        // --- components: name -> module url ---------------------------------
        let comps = componentNodes
            .map((n) => ({
                name: n.name || n.id,
                url: stripVersion(n.insertURL),
                id: n.id,
                identifier: n.componentIdentifier, // e.g. local-module:canvasComponent/<id>:default
            }))
            .filter((c) => c.url) // only components that actually have a module url

        // --- optional: export just ONE named component ----------------------
        if (ONLY) {
            const want = ONLY.toLowerCase()
            const wantPath = componentNameToPath(ONLY)
            const filtered = comps.filter(
                (c) => c.name.toLowerCase() === want || componentNameToPath(c.name) === wantPath,
            )
            if (!filtered.length) {
                console.error(`✗ no component named "${ONLY}". Available:`)
                for (const c of comps) console.error(`    · ${c.name}`)
                process.exit(3)
            }
            comps = filtered
        }

        // --- optional: restrict to the homepage ("/") ----------------------
        if (HOMEPAGE_ONLY && !ONLY) {
            const home =
                webPages.find((p) => p.path === '/') ||
                webPages.find((p) => (p.path || '').replace(/\/+$/, '') === '')
            if (!home) {
                console.error('⚠ no web page with path "/" found — exporting ALL components instead')
            } else {
                const instances = await safe(
                    () => home.getNodesWithType('ComponentInstanceNode'),
                    [],
                )
                const usedIds = new Set(instances.map((i) => i.componentIdentifier).filter(Boolean))
                const usedUrls = new Set(instances.map((i) => stripVersion(i.insertURL)).filter(Boolean))
                const filtered = comps.filter((c) => usedIds.has(c.identifier) || usedUrls.has(c.url))
                console.error(`  homepage has ${instances.length} component instance(s), matched ${filtered.length} component(s)`)
                if (filtered.length) comps = filtered
                else console.error('⚠ could not match homepage instances to components — exporting ALL')
            }
        }

        if (!comps.length) {
            console.error(
                '✗ No exportable components found. Your homepage sections must be Framer *components* ' +
                    '(not just frames) to have module URLs. Componentize them in Framer, or drop --homepage.',
            )
            process.exit(2)
        }

        const components = {}
        for (const c of comps) components[componentNameToPath(c.name)] = c.url

        // --- design tokens (color styles) -----------------------------------
        const tokens = colorStyles.map((cs) => ({
            id: cs.id,
            name: cs.name ?? cs.path ?? null,
            lightColor: cs.light ?? cs.lightColor ?? cs.color ?? '',
            darkColor: cs.dark ?? cs.darkColor ?? cs.light ?? cs.color ?? '',
        }))

        // --- build the Config that unframer's bundle() expects --------------
        const config = {
            jsx: true,
            allExternal: true, // keep react / framer-motion external
            components,
            tokens,
            locales: locales.map((l) => ({
                code: l.code ?? l.id,
                id: l.id,
                name: l.name ?? l.code ?? l.id,
                slug: l.slug ?? l.code ?? l.id,
            })),
            framerWebPages: webPages.map((p) => ({
                webPageId: p.id,
                path: p.path || '/',
            })),
            componentInstancesInIndexPage: [], // v1: example App only, not required for export
            fullFramerProjectId: projectInfo.fullId ?? projectInfo.id ?? undefined,
            projectId: projectInfo.id ?? undefined,
            projectName: projectInfo.name ?? undefined,
            pageBackgroundColor: projectInfo.backgroundColor ?? undefined,
            // breakpoints / componentBreakpoints omitted -> bundle() uses defaults
        }

        if (process.env.DUMP_CONFIG) {
            const fs = await import('node:fs')
            fs.writeFileSync(process.env.DUMP_CONFIG, JSON.stringify(config, null, 2))
            console.error(`→ dumped config to ${process.env.DUMP_CONFIG} (skipping bundle)`)
            return
        }
        console.error(
            `→ exporting ${comps.length} component(s)${HOMEPAGE_ONLY ? ' (homepage)' : ''} → ${OUT}`,
        )
        for (const c of comps) console.error(`    · ${componentNameToPath(c.name)}  ←  ${c.url}`)
        return config
    } finally {
        // IMPORTANT: close the framer-api connection BEFORE bundling. framer-api
        // installs a global undici dispatcher for its headless HTTP that collides
        // with unframer's own global dispatcher, corrupting the CSS pipeline
        // (styles.css comes out 0 bytes). Disconnect first, then bundle cleanly.
        await safe(() => framer.disconnect?.(), null)
    }
}

// ---- diagnostics: print raw SDK shapes so we can fix field names fast ------
function dumpShapes({ projectInfo, componentNodes, colorStyles, locales, webPages }) {
    const first = (a) => (Array.isArray(a) && a.length ? a[0] : null)
    const pick = (o) => (o ? Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v !== 'function')) : o)
    console.log(JSON.stringify({
        projectInfo: pick(projectInfo),
        componentNode0: pick(first(componentNodes)),
        componentCount: componentNodes.length,
        colorStyle0: pick(first(colorStyles)),
        locale0: pick(first(locales)),
        webPagePaths: webPages.map((p) => p.path),
    }, null, 2))
}

async function safe(fn, fallback) {
    try { return await fn() } catch (e) { console.error(`  (skipped: ${e?.message || e})`); return fallback }
}

// 1) gather project data over framer-api, then disconnect (inside main).
// 2) bundle() runs here, with NO framer-api connection active — see the note in main().
main()
    .then(async (config) => {
        if (!config) return // --inspect / --dump-config paths return nothing
        await bundle({ config, cwd: OUT })
        console.error(`\n✓ done. Import "${path.join(OUT, 'styles.css')}" + the component files.`)
    })
    .catch((e) => { console.error('✗ export failed:', e?.stack || e); process.exit(1) })

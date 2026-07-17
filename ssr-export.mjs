// Snapshot the React page to a single static HTML file (SSG via server render).
// No browser: react-dom/server renders the component tree; unframer's withCSS
// server path emits the per-component <style> tags inline. We inline the global
// CSS too so the result is a self-contained index.html.
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const OUT = './page-out'
const DEST = './static'
fs.mkdirSync(DEST, { recursive: true })

// 1) render the page component to static HTML (includes inline component styles)
const WholePage = (await import(path.resolve(OUT, 'whole-page.js'))).default
let body
try {
    body = renderToStaticMarkup(React.createElement(WholePage))
} catch (e) {
    console.error('SSR threw:', e?.message || e)
    process.exit(1)
}
console.error(`rendered body: ${(body.length / 1024).toFixed(0)} KB`)

// Reveal scroll-appear animations: Framer parks about-to-appear elements at
// opacity:0.001 with an entrance transform (translateY/scale). A static page has
// no JS to animate them in, so force them to their final visible state.
// opacity:0.001 is Framer's sentinel, never a real design value.
const revealed = () => {
    let n = 0
    body = body
        .replace(/opacity:0\.001;\s*transform:[^;"]*/g, () => { n++; return 'opacity:1;transform:none' })
        .replace(/transform:translate[^;"]*;\s*opacity:0\.001/g, () => { n++; return 'transform:none;opacity:1' })
        .replace(/opacity:0\.001/g, () => { n++; return 'opacity:1' })
    return n
}
console.error(`revealed ${revealed()} appear-animation elements`)

// 2) build the global CSS: inline reset.css + framer.css (referenced via @import),
//    then the project styles.css with those @import lines removed.
const stylesCss = fs.readFileSync(path.resolve(OUT, 'styles.css'), 'utf8')
const resolveUnframerStyle = (name) => {
    for (const cand of [`unframer/styles/${name}`, `unframer/src/styles/${name}`]) {
        try { return fs.readFileSync(require.resolve(cand), 'utf8') } catch {}
    }
    // last resort: walk node_modules
    const p = path.resolve('node_modules/unframer/src/styles', name)
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
}
const reset = resolveUnframerStyle('reset.css')
const framer = resolveUnframerStyle('framer.css')
const projectCss = stylesCss.replace(/@import\s+["']unframer\/styles\/[^"']+["'];?/g, '')
const globalCss = `/* reset */\n${reset}\n/* framer runtime */\n${framer}\n/* project */\n${projectCss}`
console.error(`global css: reset ${reset.length}b + framer ${framer.length}b + project ${projectCss.length}b`)

// 3) assemble the page
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>nWork (static snapshot)</title>
<style>
html,body{margin:0;padding:0;background:#0a0a0a;}
body{display:flex;justify-content:center;}
${globalCss}
</style>
</head>
<body>
${body}
</body>
</html>`
fs.writeFileSync(path.resolve(DEST, 'index.html'), html)
console.error(`✓ wrote ${DEST}/index.html  (${(html.length / 1024).toFixed(0)} KB total)`)

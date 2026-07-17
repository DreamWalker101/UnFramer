// Build the local viewer's App.jsx by reading the REAL homepage section order
// (top-level component instances on the "/" page, in tree order) via framer-api,
// then mapping each to the already-exported component file.
import { connect, isComponentInstanceNode } from 'framer-api'
import fs from 'node:fs'
import path from 'node:path'

const PROJECT = process.argv[2]
const OUT_DIR = process.argv[3] || './out-final' // where the .jsx components live
const apiKey = process.env.FRAMER_API_KEY
if (!PROJECT || !apiKey) { console.error('usage: FRAMER_API_KEY=.. node render-setup.mjs <project> [outDir]'); process.exit(1) }

const kebab = (s) => String(s || '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
const nameToPath = (name) => String(name || '').split('/').map(kebab).filter(Boolean).join('/')

const framer = await connect(PROJECT, apiKey)
let ordered = []
try {
    // identifier -> exported file path (only components we actually exported)
    const comps = await framer.getNodesWithType('ComponentNode')
    const idToPath = new Map()
    for (const c of comps) {
        const p = nameToPath(c.name)
        if (c.componentIdentifier && fs.existsSync(path.join(OUT_DIR, p + '.jsx'))) idToPath.set(c.componentIdentifier, p)
    }

    const pages = await framer.getNodesWithType('WebPageNode')
    const home = pages.find((p) => p.path === '/') || pages.find((p) => (p.path || '') === '')
    if (!home) throw new Error('no "/" page')

    // DFS the page tree; record a component instance and DON'T descend into it,
    // so we collect only the top-level sections in visual order.
    const seenTop = []
    async function walk(node, depth) {
        if (depth > 10) return
        if (isComponentInstanceNode(node)) { seenTop.push(node); return }
        let kids = []
        try { kids = (await node.getChildren?.()) || [] } catch {}
        for (const k of kids) await walk(k, depth + 1)
    }
    await walk(home, 0)

    ordered = seenTop
        .map((n) => idToPath.get(n.componentIdentifier))
        .filter(Boolean)
    console.error(`→ homepage top-level sections in order: ${ordered.length}`)
} finally {
    await framer.disconnect?.()
}

if (!ordered.length) {
    console.error('⚠ could not resolve ordered sections; falling back to all exported components')
    ordered = fs.readdirSync(OUT_DIR, { recursive: true })
        .filter((f) => typeof f === 'string' && f.endsWith('.jsx'))
        .map((f) => f.replace(/\.jsx$/, ''))
}

// de-dupe consecutive repeats but keep overall order
const sections = ordered.filter((p, i) => p !== ordered[i - 1])

// generate viewer/src/App.jsx
const importName = (p, i) => 'S' + i + '_' + p.replace(/[^a-zA-Z0-9]/g, '_')
const imports = sections.map((p, i) => `import ${importName(p, i)} from '../../${OUT_DIR.replace(/^\.\//, '')}/${p}'`).join('\n')
const body = sections.map((p, i) => `        <${importName(p, i)} key=${JSON.stringify(p + i)} />`).join('\n')
const app = `// AUTO-GENERATED desktop homepage view for project ${PROJECT}
import '../../${OUT_DIR.replace(/^\.\//, '')}/styles.css'
${imports}

export default function App() {
    return (
        <div className="unframer-page" style={{ width: '100%' }}>
${body}
        </div>
    )
}
`
fs.mkdirSync('viewer/src', { recursive: true })
fs.writeFileSync('viewer/src/App.jsx', app)
console.error(`✓ wrote viewer/src/App.jsx with ${sections.length} sections`)
console.error('   order: ' + sections.join(' → '))

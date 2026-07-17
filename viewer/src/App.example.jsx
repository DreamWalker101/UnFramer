// UnFramer viewer — example entry.
//
// Copy this to App.jsx:  cp viewer/src/App.example.jsx viewer/src/App.jsx
// then point it at your exported output. Two patterns:
//
// 1) RECOMMENDED — whole-page component (cleanest layout + order):
//    In Framer, select the whole page → "Create Component" (e.g. "Whole_Page").
//      node export.mjs <project> --only "Whole_Page" --out ./page-out
//    Then in App.jsx:
//      import '../../page-out/styles.css'
//      import WholePage from '../../page-out/whole-page'
//      export default () => (
//        <div style={{ display: 'flex', justifyContent: 'center' }}><WholePage /></div>
//      )
//
// 2) Auto-generated stitched homepage (individual sections in page order):
//      node export.mjs <project> --homepage --out ./out
//      node render-setup.mjs <project> ./out     # writes viewer/src/App.jsx for you

export default function App() {
    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'system-ui, sans-serif',
                color: '#e7e9f0',
                background: '#0c0e14',
                textAlign: 'center',
                padding: 24,
            }}
        >
            <div style={{ maxWidth: 560 }}>
                <h1 style={{ fontSize: 28, margin: '0 0 12px', letterSpacing: '-0.02em' }}>UnFramer viewer</h1>
                <p style={{ color: '#aeb4c4', lineHeight: 1.6 }}>
                    Copy <code>App.example.jsx</code> → <code>App.jsx</code> and point it at your exported
                    Framer output. See the README for the two patterns.
                </p>
            </div>
        </div>
    )
}

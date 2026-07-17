// UnFramer viewer — RESPONSIVE whole-page template.
//
// Copy this to App.jsx:  cp viewer/src/App.example.jsx viewer/src/App.jsx
//
// Strategy: one whole-page component PER Framer breakpoint (full per-instance
// content fidelity), with only the ACTIVE breakpoint mounted via matchMedia.
// Mounting all breakpoints at once would run multiple SmoothScroll/lenis
// instances fighting over scroll — so we swap the mounted component on resize.
//
// 1) In Framer, Create Component from each breakpoint frame of your page:
//      Whole_Page (desktop), Whole_Page_Tablet, Whole_Page_Phone
// 2) Export each:
//      node export.mjs <project> --only "Whole_Page"        --out ./page-out
//      node export.mjs <project> --only "Whole_Page_Tablet" --out ./page-tablet
//      node export.mjs <project> --only "Whole_Page_Phone"  --out ./page-phone
// 3) Point the imports below at each dir, and set BREAKPOINTS to your project's
//    real thresholds (read them from the exported component's @media queries).
import { useSyncExternalStore } from 'react'
import '../../page-out/styles.css'

import Desktop from '../../page-out/whole-page'
// import Tablet from '../../page-tablet/whole-page-tablet'
// import Phone  from '../../page-phone/whole-page-phone'
const Tablet = Desktop // ← replace once Whole_Page_Tablet is exported
const Phone = Desktop //  ← replace once Whole_Page_Phone is exported

// Framer breakpoint upper bounds (px). Example project: Desktop >=1200,
// Tablet 810-1199, Phone <=809.
const BREAKPOINTS = { phone: 809, tablet: 1199 }

function current() {
    if (typeof window === 'undefined') return 'desktop'
    const w = window.innerWidth
    if (w <= BREAKPOINTS.phone) return 'phone'
    if (w <= BREAKPOINTS.tablet) return 'tablet'
    return 'desktop'
}
const subscribe = (cb) => {
    window.addEventListener('resize', cb)
    return () => window.removeEventListener('resize', cb)
}
const useBreakpoint = () => useSyncExternalStore(subscribe, current, () => 'desktop')

export default function App() {
    const bp = useBreakpoint()
    const Page = bp === 'phone' ? Phone : bp === 'tablet' ? Tablet : Desktop
    return (
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', minHeight: '100vh' }}>
            <Page />
        </div>
    )
}

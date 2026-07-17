import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// NOTE: no React.StrictMode — Framer components double-invoke badly under it.
createRoot(document.getElementById('root')).render(<App />)

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Serve the viewer/ app. Components live in ../out-final (outside root), so we
// allow filesystem access to the whole framer-diy-export dir. Deps (react,
// react-dom, unframer) resolve from framer-diy-export/node_modules.
export default defineConfig({
    root: path.resolve('viewer'),
    plugins: [react()],
    server: {
        host: true,
        port: 5188,
        fs: { allow: [path.resolve('.')] },
    },
    optimizeDeps: {
        include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'unframer'],
    },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base: GitHub Pages serves the app under /appointments-api/app/.
export default defineConfig({ base: './', plugins: [react()], server: { port: 5174 } })

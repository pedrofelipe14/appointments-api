import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base: GitHub Pages serves the portal under /court-booking-api/.
export default defineConfig({ base: './', plugins: [react()] })

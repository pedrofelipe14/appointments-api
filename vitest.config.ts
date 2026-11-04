import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// SWC instead of esbuild: Nest's dependency injection needs decorator metadata.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts'],
    fileParallelism: false, // the e2e suites share one database
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})

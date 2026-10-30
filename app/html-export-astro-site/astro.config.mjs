import { defineConfig } from 'astro/config'

// Each page builds to its own file ("projects/launch-plan.html"), which works on every static host
// and opened straight from disk.
export default defineConfig({
  build: { format: 'file' },
  trailingSlash: 'never',
})

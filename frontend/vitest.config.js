import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Tests du front (npm test). Fichier à part de vite.config.js : la construction (npm run build) n'en dépend pas.
// Les tests sont hors de src/ pour que Tailwind n'y cherche pas de classes.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
  },
})

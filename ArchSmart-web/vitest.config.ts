import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest-setup.ts'],
    globals: true,
    // e2e/ é do Playwright. Sem esta linha o vitest coleta as specs de lá e
    // falha com "Playwright Test did not expect test.describe() to be called
    // here" — o portão de CI da Seção 3 nasceria vermelho por causa disso.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

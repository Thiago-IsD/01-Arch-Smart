import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  // O cold start do Render free tier foi medido em 41,9 s (ADR 0009) e em
  // 41,4 s em 08/09/2026, e os specs que abrem /library pagam esse tempo na
  // primeira chamada. Os defaults do Playwright — 30 s por teste e 30 s por
  // `waitForSelector` — ficam ABAIXO disso: no CI, onde nada aqueceu a API
  // antes, o cold start reprovaria o spec por timeout, que e falha sem
  // defeito de codigo. So no CI: localmente 30 s continuam bons, e timeout
  // frouxo na maquina de quem desenvolve transforma tela travada em espera
  // longa.
  timeout: process.env.CI ? 120 * 1000 : 30 * 1000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // `actionTimeout` vira o default de `page.setDefaultTimeout` (pega o
    // `waitForSelector` de `e2e/biblioteca.ts`); `navigationTimeout` vira o de
    // `page.goto`. 0 e "sem limite", e ai quem corta e o `timeout` acima.
    actionTimeout: process.env.CI ? 60 * 1000 : 0,
    navigationTimeout: process.env.CI ? 60 * 1000 : 0,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Para correr los tests E2E:
 *   Opcion A (recomendado -- dev server ya arriba):
 *     Terminal 1: pnpm web
 *     Terminal 2: pnpm test:e2e
 *
 *   Opcion B (sin servidor previo, Playwright lo levanta solo):
 *     pnpm test:e2e   <- primer run lento (~3 min compilando Metro)
 *
 * Requiere: servidor Convex operativo (dev:curious-sheep-977).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,          // primer page.goto puede tardar ~45s compilando Metro
  expect: { timeout: 10_000 },
  fullyParallel: false,     // Convex compartido -> tests secuenciales para evitar conflictos
  retries: 1,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // reuseExistingServer:true -> usa el dev server si ya esta corriendo en :8081.
  // Si no hay servidor, lo arranca y espera hasta 3 min (primer build de Metro).
  webServer: {
    command: 'pnpm --filter @impostor/mobile run web',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

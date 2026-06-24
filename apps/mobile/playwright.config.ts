import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
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

  // Arranca el servidor Expo web antes de los tests.
  // Usá reuseExistingServer:true para correr contra uno ya levantado.
  webServer: {
    command: 'pnpm --filter @impostor/mobile run web',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

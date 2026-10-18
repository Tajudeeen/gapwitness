import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://localhost:5173', headless: true, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
  webServer: [
    {command: `${process.env.GAPWITNESS_PYTHON || 'python'} -m uvicorn app.main:app --app-dir ../checker --host 127.0.0.1 --port 8000`,
      url: 'http://localhost:8000/health', reuseExistingServer: !process.env.CI,
      env: {INSPECT_RATE_LIMIT: '10000', WEB_ORIGIN: 'http://localhost:5173'}},
    { command: 'npm run dev -- --host 127.0.0.1', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
  ],
});

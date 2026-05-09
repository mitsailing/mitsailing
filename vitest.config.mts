import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    coverage: {
      provider: 'v8',
      // lcov: Codecov; json-summary: machine-readable totals in CI logs
      reporter: ['text', 'lcov', 'json', 'html', 'json-summary'],
      // Emit coverage even when a test fails so CI uploads still have data.
      reportOnFailure: true,
      include: ['src/**/*.{ts,tsx,js,jsx}', 'emails/**/*.{ts,tsx,js,jsx}'],
      exclude: [
        'src/**/*.stories.{js,jsx,ts,tsx}',
        'src/**/*.test.{js,jsx,ts,tsx}',
        'emails/**/*.test.{js,jsx,ts,tsx}',
        'src/**/*.d.ts',
        'src/generated/**',
        'src/types/**',
        'src/test/**',
        'src/styles/**',
        'src/data/**',
        'src/locales/**',
        'src/instrumentation.ts',
        'src/instrumentation-client.ts',
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{js,ts}'],
          exclude: ['src/hooks/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          include: ['src/**/*.test.{jsx,tsx}', 'emails/**/*.test.{jsx,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/setup/component.tsx'],
        },
      },
      {
        extends: true,
        test: {
          name: 'contract',
          include: ['tests/integration/**/*.contract.spec.ts'],
          environment: 'node',
          testTimeout: 45_000,
          hookTimeout: 45_000,
        },
      },
    ],
    reporters: [
      'default',
      // JUnit XML is required by Codecov Test Analytics.
      ['junit', { outputFile: './test-report.junit.xml' }],
      // conditional reporter
      process.env.CI ? 'github-actions' : {},
    ],
    env: loadEnv('', process.cwd(), ''), // Expose .env variables to Node.js
  },
  define: {
    'process.env': JSON.stringify(loadEnv('', process.cwd(), 'NEXT_PUBLIC_')), // Expose .env variables to browser
  },
});

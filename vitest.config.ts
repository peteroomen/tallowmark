import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'test/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'test/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/combat/**', 'src/items/**', 'src/world/**', 'src/state/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});

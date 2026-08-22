import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/lib/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/index.ts',
        'node_modules',
        'dist',
        '.next',
        '.wrangler',
      ],
      // Ratcheted legacy debt: https://github.com/Significant-Hobbies/email-manager/issues/32
      // Raised after focused tests for inbox sync, Gmail, auth, analytics, and
      // API timing landed. Floors are set a few points below measured coverage
      // for stability against minor source changes.
      thresholds: { lines: 62, functions: 52, branches: 57, statements: 60 },
    },
  },
});

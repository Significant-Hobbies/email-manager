import { defineConfig } from 'vitest/config';

export default defineConfig({
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
      thresholds: { lines: 36, functions: 31, branches: 35, statements: 34 },
    },
  },
});

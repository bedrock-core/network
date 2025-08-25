import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'dist/**',
        'vitest.config.ts',
        'eslint.config.mjs',
        '.yarn/**',
        '**/node_modules/**',
      ],
    },
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.ts'],
    passWithNoTests: false,
  },
});

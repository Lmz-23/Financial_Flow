import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Fechas deterministas: la app opera en America/Bogota.
    env: { TZ: 'America/Bogota' },
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    alias: {
      'expo-sqlite': './test/mocks/expo-sqlite.ts',
    },
  },
});

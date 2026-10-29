// Mock for expo-sqlite
// This allows tests to run in Node.js environment

import { vi } from 'vitest';

export const openDatabaseSync = vi.fn(() => ({
  runAsync: vi.fn(),
  run: vi.fn(),
  queryAsync: vi.fn(),
  query: vi.fn(),
  transaction: vi.fn(),
}));

export const openDatabaseAsync = vi.fn(() => Promise.resolve({
  runAsync: vi.fn(),
  run: vi.fn(),
  queryAsync: vi.fn(),
  query: vi.fn(),
  transaction: vi.fn(),
}));

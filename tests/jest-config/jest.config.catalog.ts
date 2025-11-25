import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  rootDir: '../..',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/e2e/catalog.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  maxWorkers: 1,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  transform: {
    '^.+\\.(ts)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
        diagnostics: false,
      },
    ],
  },
  reporters: ['default'],
  testTimeout: 60000, // Catalog testleri daha uzun sürebilir (DB işlemleri)
};

export default config;


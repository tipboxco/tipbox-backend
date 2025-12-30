import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  rootDir: '../..',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/e2e/feed*.test.ts'],
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
  testTimeout: 600000, // 10 dakika (feed distribution için uzun bekleme süreleri var)
};

export default config;



import type { Config } from 'jest';

export const baseConfig: Config = {
  testEnvironment: 'node',
  rootDir: '../..',
  roots: ['<rootDir>/tests'],
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
  reporters: [
    'default',
    ['<rootDir>/scripts/custom-jest-reporter.js', {}],
  ],
  testTimeout: 30000,
};


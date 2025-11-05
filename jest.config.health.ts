import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/e2e/health.test.ts'],
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
    [
      'jest-html-reporters',
      {
        publicPath: './test-results',
        filename: 'health-report.html',
        openReport: false,
        inlineSource: true,
        expand: true,
        pageTitle: 'Tipbox API Health Test Results',
      },
    ],
  ],
  testTimeout: 15000,
};

export default config;



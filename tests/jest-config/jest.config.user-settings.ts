import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  rootDir: '../..',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/e2e/user-settings.test.ts'],
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
        filename: 'user-settings-report.html',
        openReport: false,
        inlineSource: true,
        expand: true,
        pageTitle: 'Tipbox API User Settings Test Results',
      },
    ],
    ['<rootDir>/scripts/custom-jest-reporter.js', {}],
  ],
  testTimeout: 30000,
};

export default config;



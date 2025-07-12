/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  setupFilesAfterEnv: ['<rootDir>/test-jest/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@onix-js/uxec)/)'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          target: 'ES2022',
          module: 'ES2022',
          moduleResolution: 'node',
          allowJs: true,
          esModuleInterop: true,
          resolveJsonModule: true,
          strict: false,
          skipLibCheck: true,
          allowImportingTsExtensions: false,
        },
      },
    ],
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        target: 'ES2022',
        module: 'ES2022',
        moduleResolution: 'NodeNext',
        allowJs: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        strict: false,
        skipLibCheck: true,
        allowImportingTsExtensions: false,
      }
    }
  },
  testMatch: [
    '<rootDir>/test-jest/**/*.test.ts',
    '<rootDir>/test-jest/**/*.test.js',
  ],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.test.{ts,js}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(@onix-js/uxec)/)',
  ],
  testTimeout: 10000,
};
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // next.config.jsとテスト環境の.envファイルを読み込むためにNext.jsアプリのディレクトリを指定
  dir: './',
})

/** @type {import('jest').Config} */
const customJestConfig = {
  // テストファイルのパターン
  testMatch: [
    '**/__tests__/**/*.(test|spec).(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],

  // テスト環境
  testEnvironment: 'jest-environment-jsdom',

  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // モジュール名のエイリアス
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // カバレッジ設定
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],

  // カバレッジ閾値
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },

  // テストタイムアウト
  testTimeout: 10000,

  // 変換対象外（ESMモジュールを除外しない）
  transformIgnorePatterns: [
    '/node_modules/(?!(isomorphic-dompurify|dompurify|@panva|jose|nanoid|uuid)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],

  // モックファイルの場所
  moduleDirectories: ['node_modules', '<rootDir>/'],

  // 無視するパス
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
  ],

  // モジュール解決で無視するパス
  modulePathIgnorePatterns: [
    '<rootDir>/.next/',
  ],

  // Haste衝突を防ぐ
  haste: {
    forceNodeFilesystemAPI: true,
  },
}

module.exports = createJestConfig(customJestConfig)

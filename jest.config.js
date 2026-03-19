module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/js/**/*.test.js'
  ],
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/app.js', // Entry point, tested indirectly
    '!**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/js/$1'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  globals: {
    L: 'readonly',
    lucide: 'readonly'
  }
};

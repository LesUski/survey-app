module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/lambda'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  // Separate test projects for unit and integration tests
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/test/*.test.ts', '<rootDir>/lambda/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest'
      },
      moduleNameMapper: {
        // Resolve module naming collision
        '^utils$': '<rootDir>/lambda/handlers/__mocks__/utils.js'
      }
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest'
      },
      // Integration tests have a longer timeout
      testTimeout: 60000,
      modulePathIgnorePatterns: [
        // Ignore compiled CDK assets to avoid naming collisions
        '<rootDir>/cdk.out/',
        '<rootDir>/node_modules/'
      ]
    }
  ]
};
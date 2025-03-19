import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import eslintPluginImport from 'eslint-plugin-import';

export default [
  {
    // Define global ignores (replaces .eslintignore)
    ignores: [
      'node_modules/**',
      'build/**',
      'cdk.out/**',
      'dist/**',
      'coverage/**',
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.js',
    ],
  },
  // Apply prettier config
  prettierConfig,
  // Apply TypeScript ESLint recommended configs
  ...tseslint.configs.recommended,
  // Import plugin
  {
    plugins: {
      import: eslintPluginImport,
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
        typescript: {},
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
    rules: {
      // Import rules
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-unresolved': 'error',

      // Other general rules
      'no-console': 'off', // Allow console.log in Lambda functions
      'max-len': ['warn', { code: 100, ignoreUrls: true, ignoreStrings: true }],

      // TypeScript specific rules
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      '@typescript-eslint/no-explicit-any': [
        'warn',
        {
          // Locations where 'any' is acceptable
          ignoreRestArgs: true,
          fixToUnknown: false,
        },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Special rules for CDK code
  {
    files: ['bin/survey-app.ts', 'lib/**/*.ts'],
    rules: {
      'no-new': 'off', // Allow instantiation without assignment in CDK code
    },
  },
  // Special rules for Lambda handlers
  {
    files: ['lambda/handlers/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' in Lambda handlers where working with API Gateway
    },
  },
  // Interfaces for API events and responses
  {
    files: ['lambda/**/*types.ts', 'lambda/**/models/**/*.ts', '**/db.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' for database and model definitions
    },
  },
  // Test files can use 'any' more liberally
  {
    files: [
      '**/*.test.ts',
      '**/__mocks__/**/*.ts',
      'test/integration/*.ts', // Include all integration test files explicitly
      'test/integration/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' in test files
    },
  },
  // This config for the config file itself (needed because we're using JS for the config)
  {
    files: ['eslint.config.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
    },
  },
];

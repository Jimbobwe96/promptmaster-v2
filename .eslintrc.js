module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  env: {
    node: true,
    es6: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ],
    'no-console': [
      'warn',
      {
        allow: ['warn', 'error']
      }
    ]
  },
  overrides: [
    // Frontend specific rules
    {
      files: ['apps/frontend/**/*.{ts,tsx}'],
      extends: [
        'next/core-web-vitals',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'prettier'
      ],
      env: {
        browser: true,
        node: true,
        es6: true
      },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
        'react/display-name': 'off'
      },
      settings: {
        react: {
          version: 'detect'
        }
      }
    },
    // Backend specific rules
    {
      files: ['apps/backend/**/*.ts'],
      env: {
        node: true,
        es6: true
      },
      rules: {
        'no-console': 'off' // Allow console logs in backend
      }
    },
    // Shared package rules
    {
      files: ['packages/shared/**/*.ts'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'error'
      }
    }
  ],
  ignorePatterns: [
    'node_modules',
    'dist',
    '.next',
    'build',
    '*.js',
    '!.eslintrc.js'
  ]
};

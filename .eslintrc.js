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
    'comma-dangle': ['error', 'never'],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
        args: 'none',
        destructuredArrayIgnorePattern: '^_'
      }
    ],
    'no-console': 'off'
  },
  overrides: [
    // Frontend specific rules
    {
      files: ['apps/frontend/**/*.{ts,tsx}'],
      extends: ['plugin:react/recommended', 'next/core-web-vitals', 'prettier'],
      env: {
        browser: true,
        node: true,
        es6: true
      },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
        'react/display-name': 'off',
        '@next/next/no-img-element': 'off',
        'no-console': 'off',
        '@next/next/no-html-link-for-pages': 'off'
      },
      settings: {
        react: {
          version: 'detect'
        },
        next: {
          rootDir: 'apps/frontend'
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
        'no-console': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^(Request|Response|NextFunction)$'
          }
        ]
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

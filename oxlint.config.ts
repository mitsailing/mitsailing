import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import next from 'ultracite/oxlint/next';
import react from 'ultracite/oxlint/react';

export default defineConfig({
  extends: [core, next, react],
  ignorePatterns: [
    'mit-redesign/**',
    'donation-figma/**',
    'zenstack/input.ts',
    'zenstack/models.ts',
    'zenstack/schema.ts',
  ],
  options: {
    reportUnusedDisableDirectives: 'off',
  },
  overrides: [
    {
      files: ['src/data/mit-sailing/**'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        complexity: 'off',
        'jsdoc/require-param': 'off',
        'jsdoc/require-param-description': 'off',
        'jsdoc/require-returns': 'off',
        'jsdoc/require-returns-description': 'off',
        'no-negated-condition': 'off',
        'no-use-before-define': 'off',
        'unicorn/prefer-structured-clone': 'off',
      },
    },
  ],
  rules: {
    'func-style': 'off',
    'jsx-a11y/control-has-associated-label': 'off',
    'jsx-a11y/no-interactive-element-to-noninteractive-role': 'off',
    'jsx-a11y/no-redundant-roles': 'off',
    'jsx-a11y/prefer-tag-over-role': 'off',
    'jsdoc/require-param': 'error',
    'jsdoc/require-param-description': 'error',
    'jsdoc/require-returns': 'error',
    'jsdoc/require-returns-description': 'error',
    'no-inline-comments': 'off',
    'no-warning-comments': 'off',
    'require-unicode-regexp': 'off',
    'react-perf/jsx-no-new-function-as-prop': 'off',
    'sort-keys': 'off',
    'typescript/consistent-type-definitions': ['error', 'type'],
    'typescript/consistent-return': 'off',
    'typescript/dot-notation': 'off',
    'typescript/no-misused-promises': 'off',
    'typescript/no-unnecessary-type-conversion': 'off',
    'typescript/no-unsafe-argument': 'off',
    'typescript/no-unsafe-assignment': 'off',
    'typescript/no-unsafe-call': 'off',
    'typescript/no-unsafe-member-access': 'off',
    'typescript/prefer-regexp-exec': 'off',
    'typescript/return-await': 'off',
    'typescript/strict-boolean-expressions': 'off',
    'typescript/strict-void-return': 'off',
    'unicorn/consistent-function-scoping': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/no-negated-condition': 'off',
    'unicorn/text-encoding-identifier-case': 'off',
  },
});

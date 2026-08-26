import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'prisma/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { console: 'readonly', process: 'readonly', fetch: 'readonly' },
    },
    rules: {
      // Unused imports and variables are the ones worth catching here; leading
      // underscores mark deliberately ignored parameters.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-undef': 'off',
    },
  },
);

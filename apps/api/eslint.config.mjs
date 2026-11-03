// ESLint 9 flat config — @app/api (NestJS)
// Roda via `pnpm --filter @app/api lint` (eslint "src/**/*.ts" --fix).
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Artefatos e o próprio config ficam fora do lint.
  { ignores: ['dist/**', '.turbo/**', 'coverage/**', 'node_modules/**', 'eslint.config.mjs'] },

  // Regras base do ESLint + recomendadas do typescript-eslint (sem type-checking,
  // para não depender de parserOptions.project e manter o lint rápido).
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // O TypeScript já resolve identificadores — evita falsos positivos com
      // globals de Node (process, console) e de teste (describe, it, expect).
      'no-undef': 'off',
      // NestJS usa muito DI e decorators; afrouxamos o que atrapalha sem ganho real.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);

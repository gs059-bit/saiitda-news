import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: { sourceType: 'module', globals: globals.browser },
    rules: {
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error'
    }
  },
  {
    // window.SAIITDA_CONFIG를 정의하는 일반 스크립트
    files: ['config.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser }
  }
];

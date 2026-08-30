import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import-x';
import nodePlugin from 'eslint-plugin-n';
import globals from 'globals';

export default [
    {
        ignores: [
            'node_modules/',
            'dist/',
            'release/',
            'release-builds/',
            'resources/',
            'logs/',
            'dev/',
            'eslint.config.mjs'
        ]
    },
    js.configs.recommended,
    importPlugin.flatConfigs.errors,
    importPlugin.flatConfigs.warnings,
    nodePlugin.configs['flat/recommended-script'],
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2018,
            globals: {
                ...globals.browser,
                ...globals.commonjs,
                ...globals.jest,
                ...globals.node,
                $: 'readonly',
                configuration: 'readonly',
                i18n: 'readonly'
            }
        },
        rules: {
            indent: ['error', 4, { SwitchCase: 1 }],
            'linebreak-style': ['error', 'unix'],
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
            'no-console': 'off',
            'no-unused-vars': ['warn'],
            'no-var': 'warn',
            'prefer-const': 'warn',
            eqeqeq: ['warn', 'always'],
            'n/no-unsupported-features/es-syntax': 'off',
            'n/no-deprecated-api': 'warn',
            'n/no-missing-require': 'warn',
            'n/no-unpublished-require': 'off',
            'n/no-extraneous-require': 'off',
            'n/no-unsupported-features/node-builtins': 'off',
            'no-empty': 'warn',
            'no-mixed-spaces-and-tabs': 'warn',
            'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
            'no-trailing-spaces': 'error',
            'padded-blocks': ['error', 'never'],
            'eol-last': ['error', 'always']
        }
    }
];

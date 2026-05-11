import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';

import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';

export default [
    {
        files: ['**/*.js'],
        plugins: {        
            jsdoc,
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'no-console': 'warn',
            eqeqeq: 'error',
            curly: 'error',
            'no-var': 'error',
            'prefer-const': 'warn',

            'jsdoc/require-jsdoc': ['warn', {
                require: {
                    FunctionDeclaration: true,
                    MethodDefinition: true,
                    ClassDeclaration: true,
                    ArrowFunctionExpression: false,
                },
            }],
            'jsdoc/require-param': 'warn',
            'jsdoc/require-param-description': 'warn',
            'jsdoc/require-param-type': 'warn',
            'jsdoc/require-returns': 'warn',
            'jsdoc/check-param-names': 'error',
            'jsdoc/check-types': 'error',
        },
    },
    {
        ignores: ['node_modules/', 'dist/', 'build/', 'coverage/', '.wrangler/', 'research/'],
    },
    eslintConfigPrettier,
];
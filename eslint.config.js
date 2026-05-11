import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
	{
		files: ['**/*.js'],
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
		},
	},
	{
		ignores: ['node_modules/', 'dist/', 'build/', 'coverage/', '.wrangler/', 'research/'],
	},
	eslintConfigPrettier,
];

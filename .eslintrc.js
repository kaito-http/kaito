module.exports = {
	env: {
		es2021: true,
		node: true,
	},
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'xo',
		'xo-typescript',
	],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 12,
		sourceType: 'module',
		project: './tsconfig.base.json',
	},
	plugins: ['@typescript-eslint'],
	rules: {
		'@typescript-eslint/indent': 0,
		'@typescript-eslint/explicit-module-boundary-types': 0,
		'@typescript-eslint/comma-dangle': 0,
	},
	ignorePatterns: ['dist', '.eslintrc.js'],
};

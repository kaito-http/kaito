const path = require('path');

module.exports = {
	env: {
		es2021: true,
		node: true,
	},
	extends: [
		'next',
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'xo',
		'xo-typescript',
	],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 12,
		sourceType: 'module',
		project: path.join(__dirname, 'tsconfig.base.json'),
	},
	plugins: ['@typescript-eslint'],
	rules: {
		'@typescript-eslint/indent': 'off',
		'@typescript-eslint/comma-dangle': 'off',
		'@typescript-eslint/triple-slash-reference': 'off',
		'@typescript-eslint/naming-convention': 'off',
		'@typescript-eslint/ban-types': [
			'error',
			{
				extendDefaults: true,
				types: {
					'{}': false,
				},
			},
		],
	},
	ignorePatterns: ['dist', '.eslintrc.js'],
};

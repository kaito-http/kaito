// @ts-check

import makeWithNextra from 'nextra';

const withNextra = makeWithNextra({
	theme: 'nextra-theme-docs',
	themeConfig: './src/theme.config.tsx',
});

export default withNextra({
	reactStrictMode: true,
});

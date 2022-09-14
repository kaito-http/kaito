// @ts-check

import makeWithNextra from 'nextra';

const withNextra = makeWithNextra({
	theme: 'nextra-theme-docs',
	themeConfig: './theme.config.tsx',
	unstable_flexsearch: true,
	unstable_staticImage: true,
	unstable_defaultShowCopyCode: true,
	unstable_readingTime: true,
});

export default withNextra({});

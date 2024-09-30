import urlcat from 'es-urlcat';
import type {DocsThemeConfig} from 'nextra-theme-docs';
import {useConfig} from 'nextra-theme-docs';
import React from 'react';

const config: DocsThemeConfig = {
	project: {
		link: 'https://github.com/kaito-http/kaito',
	},

	docsRepositoryBase: 'https://github.com/kaito-http/kaito/blob/master/apps/docs',

	toc: {
		float: true,
	},

	sidebar: {},

	feedback: {
		labels: 'docs-feedback',
		content: 'Feedback',
	},

	logo: <span>Kaito</span>,

	footer: {
		text: (
			<span>
				An open-source project by <a href="https://alistair.sh">Alistair Smith</a>
			</span>
		),
	},

	chat: {
		link: 'https://discord.gg/PeEPDMKBEn',
	},

	head: function Head() {
		const config = useConfig();

		const meta = config.frontMatter as {title?: string; description?: string; image?: string};
		const title = config.title ?? meta.title;

		const ogImage =
			meta.image ??
			urlcat('https://ogmeta.kaito.cloud', '/', {
				title,
				subtitle: meta.description ?? undefined,
				dark: 'true',
			});

		return (
			<>
				<meta name="msapplication-TileColor" content="#ffffff" />
				<meta httpEquiv="Content-Language" content="en" />
				<meta name="description" content={meta.description ?? 'Kaito: An HTTP framework for TypeScript'} />
				<meta name="og:description" content={meta.description ?? 'Kaito: An HTTP framework for TypeScript'} />
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:site" content="@alistaiiiir" />
				<meta name="twitter:image" content={ogImage} />
				<meta name="og:title" content={title ? title + ' — Hop' : 'Kaito: An HTTP framework for TypeScript'} />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta name="description" content="Kaito: An HTTP framework for TypeScript" />
				<meta name="og:title" content="Kaito: An HTTP framework for TypeScript" />{' '}
				<meta name="og:image" content={ogImage} />
				<title>{title}</title>
			</>
		);
	},
};

export default config;

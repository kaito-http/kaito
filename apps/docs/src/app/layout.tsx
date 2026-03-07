import {Footer, Layout, Navbar} from 'nextra-theme-docs';
import {Head, Search} from 'nextra/components';
import {getPageMap} from 'nextra/page-map';
import 'nextra-theme-docs/style.css';
import type {ReactNode} from 'react';

export const metadata = {
	title: {
		default: 'Kaito',
		template: '%s — Kaito',
	},
	description: 'Kaito: An HTTP framework for TypeScript',
	twitter: {
		card: 'summary_large_image',
		site: '@alistaiir',
	},
};

export default async function RootLayout({children}: {children: ReactNode}) {
	return (
		<html lang="en" dir="ltr" suppressHydrationWarning>
			<Head faviconGlyph="✦" />
			<body>
				<Layout
					navbar={
						<Navbar
							logo={<span>Kaito</span>}
							projectLink="https://github.com/kaito-http/kaito"
							chatLink="https://discord.gg/PeEPDMKBEn"
						/>
					}
					pageMap={await getPageMap()}
					docsRepositoryBase="https://github.com/kaito-http/kaito/blob/main/apps/docs"
					editLink="Edit this page on GitHub"
					feedback={{labels: 'docs-feedback', content: 'Feedback'}}
					footer={
						<Footer>
							An open-source project by <a href="https://alistair.sh">Alistair Smith</a>
						</Footer>
					}
					search={<Search />}
				>
					{children}
				</Layout>
			</body>
		</html>
	);
}

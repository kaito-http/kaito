/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import 'nextra-theme-docs/style.css';

export default function Nextra({Component, pageProps}) {
	const getLayout = Component.getLayout || (page => page);
	return getLayout(<Component {...pageProps} />);
}

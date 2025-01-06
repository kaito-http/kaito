// /* Minimal HTTP/3 example */

// const uWS = require('../dist/uws.js');
// const port = 9001;

// /* ./quiche-client --no-verify https://localhost:9001 */

// /* The only difference here is that we use uWS.H3App rather than uWS.App or uWS.SSLApp.
//  * And of course, there are no WebSockets in HTTP/3 only WebTransport (coming) */

// const app = uWS.H3App({
//   key_file_name: 'misc/key.pem',
//   cert_file_name: 'misc/cert.pem',
//   passphrase: '1234'
// }).get('/*', (res, req) => {
//   res.end('H3llo World!');
// }).listen(port, (token) => {
//   if (token) {
//     console.log('Listening to port ' + port);
//   } else {
//     console.log('Failed to listen to port ' + port);
//   }
// });

import uWS from 'uWebSockets.js';

export interface ServeOptions {
	port: number;
	fetch: (request: Request) => Promise<Response>;
}

export class KaitoServer {
	public static async serve(options: ServeOptions) {
		const app = uWS.App().get('/*', (res, req) => {
			const headers = new Headers();
			req.forEach((key, value) => {
				headers.set(key, value);
			});

			const body = new ReadableStream({
				start(controller) {
					//
				},
			});

			const request = new Request(req.getUrl(), {
				headers,
				method: req.getMethod(),
				body,
			});

			const response = await options.fetch(request);
		});

		app.listen(options.port, () => {
			console.log(`Listening on port ${options.port}`);
		});

		const server = new KaitoServer(app);
	}

	private readonly app: uWS.App;

	private constructor(app: uWS.App) {
		//
	}
}

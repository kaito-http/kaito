import type {KaitoError} from './error.ts';
import type {KaitoRequest} from './request.ts';
import type {Router} from './router/router.ts';
import type {GetContext} from './util.ts';

export type HandlerConfig<ContextFrom> = {
	/**
	 * The root router to mount on this handler.
	 */
	router: Router<ContextFrom, unknown, any>;

	/**
	 * A function that is called to get the context for a request.
	 *
	 * This is useful for things like authentication, to pass in a database connection, etc.
	 *
	 * It's fine for this function to throw; if it does, the error is passed to the `onError` function.
	 */
	getContext: GetContext<ContextFrom>;

	/**
	 * A function that is called when an error occurs inside a route handler.
	 *
	 * The result of this function is used to determine the response status and message, and is
	 * always sent to the client. You could include logic to check for production vs development
	 * environments here, and this would also be a good place to include error tracking
	 * like Sentry or Rollbar.
	 *
	 * @param arg - The error thrown, and the KaitoRequest instance
	 * @returns A KaitoError or an object with a status and message
	 */
	onError: (arg: {error: Error; req: KaitoRequest}) => Promise<KaitoError | {status: number; message: string}>;

	/**
	 * A function that is called before every request. Most useful for bailing out early in the case of an OPTIONS request.
	 *
	 * @example
	 * ```ts
	 * before: async req => {
	 * 	if (req.method === 'OPTIONS') {
	 * 		return new Response(null, {status: 204});
	 * 	}
	 * }
	 * ```
	 */
	before?: (req: Request) => Promise<Response | void | undefined> | Response | void | undefined;

	/**
	 * Transforms the response before it is sent to the client. Very useful for settings headers like CORS.
	 *
	 * You can also return a new response in this function, or just mutate the current one.
	 *
	 * This function WILL receive the result of `.before()` if you return a response from it. This means
	 *  you only need to define headers in a single place.
	 *
	 * @example
	 * ```ts
	 * transform: async (req, res) => {
	 * 	res.headers.set('Access-Control-Allow-Origin', 'http://localhost:3000');
	 * 	res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	 * 	res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	 * 	res.headers.set('Access-Control-Max-Age', '86400');
	 * 	res.headers.set('Access-Control-Allow-Credentials', 'true');
	 * }
	 * ```
	 */
	transform?: (req: Request, res: Response) => Promise<Response | void | undefined> | Response | void | undefined;
};

export function createKaitoHandler<Context>(config: HandlerConfig<Context>) {
	const handle = config.router.freeze(config);

	return async (request: Request): Promise<Response> => {
		if (config.before) {
			const result = await config.before(request);

			if (result instanceof Response) {
				if (config.transform) {
					const result2 = await config.transform(request, result);
					if (result2 instanceof Response) return result;
				}

				return result;
			}
		}

		const response = await handle(request);

		if (config.transform) {
			const result = await config.transform(request, response);
			if (result instanceof Response) return result;
		}

		return response;
	};
}

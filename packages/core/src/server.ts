import {App, Request, Response} from '@tinyhttp/app';
import {z, ZodNumber, ZodObject, ZodString, ZodTypeAny} from 'zod';
import {ExtractRouteParams, Method} from './types';
import * as http from 'http';

export class Server {
	public server: http.Server | null = null;

	private readonly app: App;

	constructor() {
		this.app = new App({
			settings: {
				xPoweredBy: 'kaito.cloud',
			},
		});
	}

	public stop() {
		this.server?.close();
		this.server = null;
	}

	public start(
		port: number | string | undefined = process.env.PORT,
		address?: string,
		callback?: () => unknown
	) {
		if (!port) {
			throw new Error('No port was specified. Got undefined');
		}

		this.server = this.app.listen(
			typeof port === 'number' ? port : parseInt(port, 10),
			callback,
			address
		);

		return this.server;
	}

	public route<
		Path extends string,
		Query extends ZodObject<Record<string, ZodString | ZodNumber>>,
		Body extends ZodTypeAny,
		ParamsValidation extends ZodObject<
			Record<keyof ExtractRouteParams<Path>, ZodString | ZodNumber>
		>
	>(
		method: Method,
		path: Path,
		schemas: {
			body: Body;
			query: Query;
			params: ParamsValidation;
		},
		handler: (context: {
			params: z.infer<ParamsValidation>;
			body: z.infer<Body>;
			query: z.infer<Query>;
			res: Response;
			req: Request;
		}) => unknown
	) {
		const {query = null, body = null, params = null} = schemas;

		this.app[method](path, (req, res) =>
			handler({
				params: params?.parse(req.params),
				query: query?.parse(req.query),
				body: body?.parse(req.body),
				req,
				res,
			})
		);
	}
}

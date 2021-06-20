/* eslint-disable capitalized-comments */
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
		Query extends ZodObject<Record<string, ZodString | ZodNumber>> | never,
		Body extends ZodTypeAny | never,
		ParamsValidation extends
			| ZodObject<Record<keyof ExtractRouteParams<Path>, ZodString | ZodNumber>>
			| never
	>(
		method: Method,
		path: Path,
		schemas: (null extends Body ? {body?: Body} : {body: Body}) &
			(null extends Query ? {query?: Query} : {query: Query}) &
			(null extends ParamsValidation
				? {params?: ParamsValidation}
				: {params: ParamsValidation}),
		handler: (context: {
			params: ParamsValidation extends NonNullable<ParamsValidation>
				? z.infer<ParamsValidation>
				: undefined;
			body: Body extends NonNullable<Body> ? z.infer<Body> : undefined;
			query: Query extends NonNullable<Query> ? z.infer<Query> : undefined;
			res: Response;
			req: Request;
		}) => unknown
	) {
		const {query = null, body = null, params = null} = schemas;

		this.app[method](path, (req, res) =>
			handler({
				params: params?.parse(req.params) ?? null,
				query: query?.parse(req.query) ?? null,
				body: body?.parse(req.body) ?? null,
				req,
				res,
			})
		);
	}
}

import {App, Request, Response} from '@tinyhttp/app';
import {AnyZodObject} from 'zod';
import {Context, ExtractRouteParams, Method} from './types';

export class Kaito extends App {
	public http<
		Path extends string,
		Body extends AnyZodObject,
		Query extends AnyZodObject
	>(
		method: Method,
		path: Path,
		schemas: {body: Body; query: Query},
		callback: (
			req: Context<Path, Body, Query>,
			data: {req: Request; res: Response}
		) => unknown
	) {
		this[method](path, (req, res) => {
			const context: Context<Path, Body, Query> = {
				body: schemas.body.parse(req.body),
				params: req.params as ExtractRouteParams<Path>,
				query: schemas.query.parse(req.query),
			};

			return callback(context, {req, res});
		});
	}
}

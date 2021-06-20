import {App, Request, Response} from "@tinyhttp/app";
import {z, ZodNumber, ZodObject, ZodString, ZodTypeAny} from "zod";
import {ExtractRouteParams, Method} from "./types";
import * as http from "http";

export class Server {
	private readonly app: App;
	private readonly routeCache = new Set<string>();
	public server: http.Server | null = null;

	constructor() {
		this.app = new App();
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
			throw new Error("No port was specified. Got undefined");
		}

		this.server = this.app.listen(
			typeof port === "number" ? port : parseInt(port),
			callback,
			address
		);

		return this.server;
	}

	public route<
		Path extends string,
		Query extends
			| ZodObject<Record<string, ZodString | ZodNumber>>
			| never = never,
		Body extends ZodTypeAny | never = never,
		ParamsValidation extends
			| ZodObject<Record<keyof ExtractRouteParams<Path>, ZodString | ZodNumber>>
			| never = never
	>(
		method: Method,
		path: Path,
		schemas: Partial<{
			body: Body;
			query: Query;
			params: ParamsValidation;
		}>,
		handler: (context: {
			params: ExtractRouteParams<Path>;
			body: Body extends ZodTypeAny ? z.infer<Body> : never;
			query: [Body] extends [never] ? never : z.infer<Query>;
			res: Response;
			req: Request;
		}) => unknown
	) {
		this.app[method](path, (req, res) => {
			return handler({
				params: req.params as ExtractRouteParams<Path>,
				query: schemas.query?.parse(req.query),
				body: schemas.body?.parse(req.body),
				req,
				res,
			});
		});
	}
}

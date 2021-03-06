import { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from "http";
import * as querystring from "querystring";
import { infer as ZodInfer } from "zod";

export type HTTPMethod = "get" | "post" | "put" | "delete" | "patch";

export interface ServerConstructorOptions {
  // eslint-disable-next-line @typescript-eslint/ban-types
  controllers: object[];
  logging?: boolean;
  /**
   * An error handler that
   * @param error The error that was thrown
   * @param ctx The context for this request
   */
  onError?(error: Error, ctx: KaitoContext): unknown;
}

export const enum MetadataKeys {
  "HTTP_METHOD" = "kaito:http:method",
  "SCHEMA" = "kaito:route:schema",
  "QUERY_SCHEMA" = "kaito:route:schema:query",
  "CONTROLLER_PATH" = "kaito:controller:path",
  "AVAILABLE_ROUTE_METHODS" = "kaito:route:methods",
  "ROUTE_PATH" = "kaito:route:path",
}

export interface KaitoContext<
  Body = unknown,
  Query = querystring.ParsedUrlQuery,
  Params = Record<string, string | string[]>
> {
  req: IncomingMessage;
  res: ServerResponse;
  url: string;
  path: string;
  query: Query;
  params: Params;
  body: Body;
  ip: string;
}

type KaitoDefaultContextConfig<B = unknown, Q = querystring.ParsedUrlQuery, P = Record<string, string | string[]>> = {
  body?: B;
  query?: Q;
  params?: P;
};

type TypedSchema = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _type: any;
};

/**
 * Shorter Alias for KaitoRequest
 *
 * https://github.com/microsoft/TypeScript/issues/29188
 */
export type KTX<Config extends KaitoDefaultContextConfig | TypedSchema> = Config extends TypedSchema
  ? KaitoContext<ZodInfer<Config>>
  : Config extends KaitoDefaultContextConfig
  ? KaitoContext<Config["body"], Config["query"], Config["params"]>
  : never;

export type KaitoReturnType<Body> = { body: NonNullable<Body>; status?: number; headers?: OutgoingHttpHeaders };

export type KRTInner<B> = KaitoReturnType<B> | undefined;

/**
 * The return type for a kaito request handler
 */
export type KRT<B> = Promise<KRTInner<B>>;

export type RequestHandler = <Body>(ctx: KaitoContext) => KRT<Body>;

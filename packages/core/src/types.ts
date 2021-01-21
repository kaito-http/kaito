import { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from "http";
import { ParsedUrl } from "./utils/url";
import * as querystring from "querystring";

export type Method = "get" | "post" | "put" | "delete" | "patch";

export interface ServerConstructorOptions {
  // eslint-disable-next-line @typescript-eslint/ban-types
  controllers: object[];
  onError?(error: Error, ctx: KaitoContext): unknown;
}

export enum MetadataKeys {
  "HTTP_METHOD" = "kaito:http:method",
  "SCHEMA" = "kaito:route:schema",
  "CONTROLLER_PATH" = "kaito:controller:path",
  "AVAILABLE_ROUTE_METHODS" = "kaito:route:methods",
  "ROUTE_PATH" = "kaito:route:path",
}

export interface KaitoContext<
  Body = unknown,
  Query = querystring.ParsedUrlQuery,
  Params = Record<string, string | string[]>
> {
  raw: IncomingMessage;
  res: ServerResponse;
  url: Partial<ParsedUrl> | null;
  pathname: string;
  query: Query;
  params: Params;
  body: Body;
}

/**
 * Shorter Alias for KaitoRequest
 */
export type KTX<
  Body = unknown,
  Query = querystring.ParsedUrlQuery,
  Params = Record<string, string | string[]>
> = KaitoContext<Body, Query, Params>;

export type KaitoAdvancedJsonType<Body> = { json: NonNullable<Body>; status?: number; headers?: OutgoingHttpHeaders };
export type KaitoAdvancedTextType = { text: string; status?: number; headers?: OutgoingHttpHeaders };
export type KaitoReturnType<Body> = void | NonNullable<Body> | KaitoAdvancedTextType | KaitoAdvancedJsonType<Body>;
export type RequestHandler = <Body>(ctx: KaitoContext) => Promise<KaitoReturnType<Body>> | void;

export type KRT<B> = Promise<KaitoReturnType<B>>;

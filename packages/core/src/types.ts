import { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from "http";
import { ParsedUrl } from "./utils/url";
import * as querystring from "querystring";

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type SchemaFunction<T = unknown> = (body?: T | Partial<T> | DeepPartial<T> | null) => T | boolean;

export type Method = "get" | "post" | "put" | "delete" | "patch";

export interface ServerConstructorOptions {
  // eslint-disable-next-line @typescript-eslint/ban-types
  controllers: object[];
  onError?(error: Error, req: KaitoRequest): unknown;
}

export enum MetadataKeys {
  "HTTP_METHOD" = "app:http:method",
  "SCHEMA" = "app:route:schema",
  "CONTROLLER_PATH" = "app:controller:name",
  "AVAILABLE_ROUTE_METHODS" = "app:route:methods",
  "ROUTE_PATH" = "app:route:name",
}

export interface KaitoRequest<
  Body = unknown,
  Query = querystring.ParsedUrlQuery,
  Params = Record<string, string | string[]>
> {
  raw: IncomingMessage;
  res: ServerResponse;
  url: ParsedUrl | null;
  pathname: string;
  query: Query;
  params: Params;
  body: Body;
}

/**
 * Shorter Alias for KaitoRequest
 */
export type KRQ<
  Body = unknown,
  Query = querystring.ParsedUrlQuery,
  Params = Record<string, string | string[]>
> = KaitoRequest<Body, Query, Params>;

export type KaitoAdvancedJsonType<Body> = { json: Body; status?: number; headers?: OutgoingHttpHeaders };
export type KaitoAdvancedTextType = { text: string; status?: number; headers?: OutgoingHttpHeaders };
export type KaitoReturnType<Body> = Body | KaitoAdvancedTextType | KaitoAdvancedJsonType<Body>;
export type RequestHandler = <Body>(req: KaitoRequest) => Promise<KaitoReturnType<Body>> | void;

export type KRT<B> = Promise<KaitoReturnType<B>>;

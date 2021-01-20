import { IncomingMessage, OutgoingMessage } from "http";
import { ParsedUrl } from "./utils/url";
import * as querystring from "querystring";

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type SchemaFunction<T = unknown> = (body?: T | Partial<T> | DeepPartial<T> | null) => Promise<T | boolean>;

export type Method = "get" | "post" | "put" | "delete" | "patch";

export interface ServerConstructorOptions {
  // eslint-disable-next-line @typescript-eslint/ban-types
  controllers: object[];
}

export enum MetadataKeys {
  "HTTP_METHOD" = "app:http:method",
  "SCHEMA" = "app:route:schema",
  "CONTROLLER_PATH" = "app:controller:name",
  "AVAILABLE_ROUTE_METHODS" = "app:route:methods",
  "ROUTE_PATH" = "app:route:name",
}

export interface KaitoRequest<
  Query = querystring.ParsedUrlQuery,
  Params = Record<string, string | string[]>,
  Body = unknown
> {
  raw: IncomingMessage;
  url: ParsedUrl | null;
  pathname: string;
  query: Query;
  params: Params;
  body: Body;
}

export interface KaitoResponse<Json = unknown> {
  raw: OutgoingMessage;
  write: OutgoingMessage["write"];
  end: OutgoingMessage["end"];
  json(body: Json): void;
  text(body: string): void;
}

/**
 * Shorter Alias for KaitoRequest
 */
export type KRQ = KaitoRequest;

/**
 * Shorter Alias for KaitoResponse
 */
export type KRS = KaitoResponse;

export type RequestHandler =
  | ((req: KaitoRequest, res: KaitoResponse) => void)
  | ((req: KaitoRequest) => Promise<unknown>);

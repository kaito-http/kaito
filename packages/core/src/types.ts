import { IncomingMessage, OutgoingMessage } from "http";
import { ParsedUrl } from "./utils/url";

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
  Query = Record<string, string | string[]>,
  Params = Record<string, string | string[]>,
  Body = unknown
> {
  raw: IncomingMessage;
  url: ParsedUrl;
  pathname: string;
  query: Query;
  params: Params;
  body: Body;
}

export interface KaitoResponse extends OutgoingMessage {
  json(): void;
}

export type RequestHandler =
  | ((req: KaitoRequest, res: KaitoResponse) => void)
  | ((req: KaitoRequest) => Promise<unknown>);

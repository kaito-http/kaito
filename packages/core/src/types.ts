export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SchemaFunction<T = any> = (body?: T | Partial<T> | DeepPartial<T> | null) => Promise<T | boolean>;

export type Method = "get" | "post" | "put" | "delete" | "patch";

export enum MetadataKeys {
  "HTTP_METHOD" = "app:http:method",
  "SCHEMA" = "app:route:schema",
  "CONTROLLER_PATH" = "app:controller:name",
  "AVAILABLE_ROUTE_METHODS" = "app:route:methods",
  "ROUTE_PATH" = "app:route:name",
}

export type EmptyObject = Record<string, never>;

export type ExtractRouteParams<T extends string> = string extends T
	? Record<string, string>
	: T extends `${string}:${infer Param}/${infer Rest}`
	? Record<Param | keyof ExtractRouteParams<Rest>, string>
	: T extends `${string}:${infer Param}`
	? Record<Param, string>
	: EmptyObject;

export const enum Method {
	GET = "get",
	POST = "post",
	DELETE = "delete",
	PUT = "put",
	PATCH = "patch",
}

export enum QueryType {
	STRING,
	NUMBER,
}

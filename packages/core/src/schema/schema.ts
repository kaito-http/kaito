import type {ReferenceObject, SchemaObject} from 'openapi3-ts/oas31';

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONValue[] | {[key: string]: JSONValue};

export abstract class KBaseSchema<Input, Output> {
	protected _description?: string;
	protected _example?: Input;

	abstract parse(json: unknown): Output;
	abstract serialize(value: Output): unknown;
	abstract toOpenAPI(): SchemaObject | ReferenceObject;

	description(desc: string): this {
		this._description = desc;
		return this;
	}

	example(example: Input): this {
		this._example = example;
		return this;
	}
}

export type KInferInput<Schema extends KBaseSchema<any, any>> =
	Schema extends KBaseSchema<infer Input, any> ? Input : never;

export type KInferOutput<Schema extends KBaseSchema<any, any>> =
	Schema extends KBaseSchema<any, infer Output> ? Output : never;

export type StringDef = {
	regex?: RegExp | undefined;
	regexError?: string | undefined;
};

export class KString extends KBaseSchema<string, string> {
	private def: StringDef;

	constructor(def: StringDef = {}) {
		super();
		this.def = def;
	}

	override parse(json: unknown): string {
		if (typeof json !== 'string') {
			throw new Error('Expected string');
		}
		if (this.def.regex && !this.def.regex.test(json)) {
			throw new Error(this.def.regexError);
		}
		return json;
	}

	override serialize(value: string): string {
		return this.parse(value);
	}

	regex(pattern: string | RegExp, error?: string): this {
		this.def.regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
		this.def.regexError = error;
		return this;
	}

	override toOpenAPI(): SchemaObject {
		const schema: SchemaObject = {
			type: 'string',
		};
		if (this.def.regex) {
			schema.pattern = this.def.regex.source;
		}
		if (this._description) {
			schema.description = this._description;
		}
		return schema;
	}
}

export type ScalarDef<ClientRepresentation extends JSONPrimitive, ServerRepresentation> = {
	json: KBaseSchema<ClientRepresentation, ClientRepresentation>;
	parse(jsonValue: ClientRepresentation): ServerRepresentation;
	serialize(clientValue: ServerRepresentation): ClientRepresentation;
};

export class KScalar<ClientRepresentation extends JSONPrimitive, ServerRepresentation> extends KBaseSchema<
	ClientRepresentation,
	ServerRepresentation
> {
	private def: ScalarDef<ClientRepresentation, ServerRepresentation>;

	constructor(def: ScalarDef<ClientRepresentation, ServerRepresentation>) {
		super();
		this.def = def;
	}

	override parse(json: unknown): ServerRepresentation {
		const jsonValue = this.def.json.parse(json);
		return this.def.parse(jsonValue);
	}

	override serialize(value: ServerRepresentation): unknown {
		const jsonValue = this.def.serialize(value);
		return this.def.json.serialize(jsonValue);
	}

	override toOpenAPI(): SchemaObject | ReferenceObject {
		const base = this.def.json.toOpenAPI();
		if (this._description && 'description' in base) {
			base.description = this._description;
		}
		return base;
	}
}

export type RefDef<Shape extends Record<string, KBaseSchema<any, any>>> = {
	name: string;
	shape: Shape;
};

export class KRef<Shape extends Record<string, KBaseSchema<any, any>>> extends KBaseSchema<
	{
		[K in keyof Shape]: KInferInput<Shape[K]>;
	},
	{
		[K in keyof Shape]: KInferOutput<Shape[K]>;
	}
> {
	private def: RefDef<Shape>;

	constructor(def: RefDef<Shape>) {
		super();
		this.def = def;
	}

	override parse(json: unknown): {
		[K in keyof Shape]: KInferOutput<Shape[K]>;
	} {
		if (typeof json !== 'object' || json === null) {
			throw new Error(`Expected object for ref schema: ${this.def.name}`);
		}

		const result: any = {};

		for (const key in this.def.shape) {
			if (Object.prototype.hasOwnProperty.call(this.def.shape, key)) {
				const value = (json as any)[key];
				if (value === undefined) {
					throw new Error(`Missing required property: ${key}`);
				}
				result[key] = this.def.shape[key]!.parse(value);
			}
		}

		return result;
	}

	override serialize(value: {
		[K in keyof Shape]: KInferOutput<Shape[K]>;
	}): unknown {
		const result: Record<string, unknown> = {};
		for (const key in this.def.shape) {
			if (Object.prototype.hasOwnProperty.call(this.def.shape, key)) {
				const fieldValue = (value as any)[key];
				if (fieldValue === undefined) {
					throw new Error(`Missing required property: ${key}`);
				}
				result[key] = this.def.shape[key]!.serialize(fieldValue);
			}
		}
		return result;
	}

	override toOpenAPI(): ReferenceObject {
		return {
			$ref: `#/components/schemas/${this.def.name}`,
			...(this._description ? {description: this._description} : {}),
		};
	}

	get shape() {
		return this.def.shape;
	}

	get name() {
		return this.def.name;
	}
}

export const k = {
	string() {
		return new KString();
	},

	scalar<ClientRepresentation extends JSONPrimitive, ServerRepresentation>(
		def: ScalarDef<ClientRepresentation, ServerRepresentation>,
	) {
		return new KScalar<ClientRepresentation, ServerRepresentation>(def);
	},

	ref<Shape extends Record<string, any>>(name: string, shape: Shape) {
		const def: RefDef<Shape> = {name, shape};
		return new KRef(def);
	},
};

export const id = k
	.scalar({
		json: k.string(),
		parse: value => BigInt(value),
		serialize: value => value.toString(),
	})
	.description('A user id');

export const user = k
	.ref('User', {
		id: id,
		name: k.string(),
	})
	.example({
		id: '1234',
		name: 'Alistair',
	});

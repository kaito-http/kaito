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

export type NumberDef = {
	min?: number;
	max?: number;
	integer?: boolean;
};

export class KNumber extends KBaseSchema<number, number> {
	private def: NumberDef;

	constructor(def: NumberDef = {}) {
		super();
		this.def = def;
	}

	override parse(json: unknown): number {
		if (typeof json !== 'number') {
			throw new Error('Expected number');
		}
		if (this.def.integer && !Number.isInteger(json)) {
			throw new Error('Expected integer');
		}
		if (this.def.min !== undefined && json < this.def.min) {
			throw new Error(`Number must be greater than or equal to ${this.def.min}`);
		}
		if (this.def.max !== undefined && json > this.def.max) {
			throw new Error(`Number must be less than or equal to ${this.def.max}`);
		}
		return json;
	}

	override serialize(value: number): number {
		return this.parse(value);
	}

	min(min: number): this {
		this.def.min = min;
		return this;
	}

	max(max: number): this {
		this.def.max = max;
		return this;
	}

	integer(): this {
		this.def.integer = true;
		return this;
	}

	override toOpenAPI(): SchemaObject {
		const schema: SchemaObject = {
			type: this.def.integer ? 'integer' : 'number',
		};
		if (this.def.min !== undefined) {
			schema.minimum = this.def.min;
		}
		if (this.def.max !== undefined) {
			schema.maximum = this.def.max;
		}
		if (this._description) {
			schema.description = this._description;
		}
		return schema;
	}
}

export class KBoolean extends KBaseSchema<boolean, boolean> {
	constructor() {
		super();
	}

	override parse(json: unknown): boolean {
		if (typeof json !== 'boolean') {
			throw new Error('Expected boolean');
		}
		return json;
	}

	override serialize(value: boolean): boolean {
		return this.parse(value);
	}

	override toOpenAPI(): SchemaObject {
		return {
			type: 'boolean',
			...(this._description ? {description: this._description} : {}),
		};
	}
}

export type ArrayDef<T> = {
	items: KBaseSchema<any, T>;
	minItems?: number;
	maxItems?: number;
};

export class KArray<T> extends KBaseSchema<Array<any>, Array<T>> {
	private def: ArrayDef<T>;

	constructor(def: ArrayDef<T>) {
		super();
		this.def = def;
	}

	override parse(json: unknown): Array<T> {
		if (!Array.isArray(json)) {
			throw new Error('Expected array');
		}
		if (this.def.minItems !== undefined && json.length < this.def.minItems) {
			throw new Error(`Array must contain at least ${this.def.minItems} items`);
		}
		if (this.def.maxItems !== undefined && json.length > this.def.maxItems) {
			throw new Error(`Array must contain at most ${this.def.maxItems} items`);
		}
		return json.map(item => this.def.items.parse(item));
	}

	override serialize(value: Array<T>): unknown {
		return value.map(item => this.def.items.serialize(item));
	}

	minItems(min: number): this {
		this.def.minItems = min;
		return this;
	}

	maxItems(max: number): this {
		this.def.maxItems = max;
		return this;
	}

	override toOpenAPI(): SchemaObject {
		return {
			type: 'array',
			items: this.def.items.toOpenAPI(),
			...(this.def.minItems !== undefined ? {minItems: this.def.minItems} : {}),
			...(this.def.maxItems !== undefined ? {maxItems: this.def.maxItems} : {}),
			...(this._description ? {description: this._description} : {}),
		};
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

	number() {
		return new KNumber();
	},

	boolean() {
		return new KBoolean();
	},

	array<T>(items: KBaseSchema<any, T>) {
		return new KArray({items});
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

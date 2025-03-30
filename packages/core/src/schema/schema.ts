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

export type StringFormat =
	| 'date'
	| 'date-time'
	| 'password'
	| 'byte'
	| 'binary'
	| 'email'
	| 'uuid'
	| 'uri'
	| 'hostname'
	| 'ipv4'
	| 'ipv6';

const STRING_FORMAT_REGEXES = {
	uuid: /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,
	email: /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,
	ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
	ipv6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
	date: new RegExp(
		`^((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))$`,
	),
} as const;

export type StringDef = {
	regex?: RegExp;
	regexError?: string;
	format?: StringFormat;
	minLength?: number;
	maxLength?: number;
};

export class KString extends KBaseSchema<string, string> {
	private def: StringDef;

	constructor(def: StringDef = {}) {
		super();
		this.def = def;
	}

	date(): this {
		this.def.format = 'date';
		return this;
	}

	dateTime(): this {
		this.def.format = 'date-time';
		return this;
	}

	password(): this {
		this.def.format = 'password';
		return this;
	}

	byte(): this {
		this.def.format = 'byte';
		return this;
	}

	binary(): this {
		this.def.format = 'binary';
		return this;
	}

	uri(): this {
		this.def.format = 'uri';
		return this;
	}

	hostname(): this {
		this.def.format = 'hostname';
		return this;
	}

	ipv4(): this {
		this.def.format = 'ipv4';
		return this;
	}

	ipv6(): this {
		this.def.format = 'ipv6';
		return this;
	}

	email(): this {
		this.def.format = 'email';
		return this;
	}

	uuid(): this {
		this.def.format = 'uuid';
		return this;
	}

	regex(pattern: string | RegExp, error?: string): this {
		this.def.regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
		if (error) {
			this.def.regexError = error;
		}
		return this;
	}

	minLength(min: number): this {
		this.def.minLength = min;
		return this;
	}

	maxLength(max: number): this {
		this.def.maxLength = max;
		return this;
	}

	override parse(json: unknown): string {
		if (typeof json !== 'string') {
			throw new Error('Expected string');
		}

		if (this.def.regex && !this.def.regex.test(json)) {
			throw new Error(this.def.regexError || 'String does not match pattern');
		}

		if (this.def.minLength !== undefined && json.length < this.def.minLength) {
			throw new Error(`String must be at least ${this.def.minLength} characters long`);
		}

		if (this.def.maxLength !== undefined && json.length > this.def.maxLength) {
			throw new Error(`String must be at most ${this.def.maxLength} characters long`);
		}

		if (this.def.format) {
			switch (this.def.format) {
				case 'uuid':
					if (!STRING_FORMAT_REGEXES.uuid.test(json)) {
						throw new Error('Invalid UUID format');
					}
					break;

				case 'email':
					if (!STRING_FORMAT_REGEXES.email.test(json)) {
						throw new Error('Invalid email format');
					}
					break;

				case 'ipv4':
					if (!STRING_FORMAT_REGEXES.ipv4.test(json)) {
						throw new Error('Invalid IPv4 address');
					}
					break;

				case 'ipv6':
					if (!STRING_FORMAT_REGEXES.ipv6.test(json)) {
						throw new Error('Invalid IPv6 address');
					}
					break;

				case 'date':
					if (!STRING_FORMAT_REGEXES.date.test(json)) {
						throw new Error('Invalid date format (YYYY-MM-DD)');
					}
					break;

				case 'date-time':
					try {
						const date = new Date(json);
						if (isNaN(date.getTime())) {
							throw new Error();
						}
					} catch {
						throw new Error('Invalid date-time format (ISO 8601)');
					}
					break;

				case 'byte':
					if (!/^[A-Za-z0-9+/]*={0,2}$/.test(json) || json.length % 4 !== 0) {
						throw new Error('Invalid base64 format');
					}
					break;

				case 'uri':
					try {
						new URL(json);
					} catch {
						throw new Error('Invalid URI format');
					}
					break;

				case 'hostname':
					if (
						!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
							json,
						)
					) {
						throw new Error('Invalid hostname format');
					}
					break;

				case 'binary':
					// Binary format is used to describe files, no specific validation needed
					break;

				case 'password':
					// Password format doesn't require specific validation
					break;

				default:
					this.def.format satisfies never;
					break;
			}
		}

		return json;
	}

	override serialize(value: string): string {
		return this.parse(value);
	}

	override toOpenAPI(): SchemaObject {
		const schema: SchemaObject = {
			type: 'string',
		};
		if (this.def.regex) {
			schema.pattern = this.def.regex.source;
		}
		if (this.def.format) {
			schema.format = this.def.format;
		}
		if (this.def.minLength !== undefined) {
			schema.minLength = this.def.minLength;
		}
		if (this.def.maxLength !== undefined) {
			schema.maxLength = this.def.maxLength;
		}
		if (this._description) {
			schema.description = this._description;
		}
		return schema;
	}
}

export type NumberFormat = 'float' | 'double' | 'int32' | 'int64';

export type NumberDef = {
	min?: number;
	max?: number;
	integer?: boolean;
	format?: NumberFormat;
	exclusiveMin?: boolean;
	exclusiveMax?: boolean;
	multipleOf?: number;
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

		// Check integer format first
		if (this.def.format === 'int32' || this.def.format === 'int64' || this.def.integer) {
			if (!Number.isInteger(json)) {
				throw new Error('Expected integer');
			}

			// Additional format-specific validations
			if (this.def.format === 'int32') {
				if (json < -2147483648 || json > 2147483647) {
					throw new Error('Integer must be within 32-bit range (-2^31 to 2^31-1)');
				}
			} else if (this.def.format === 'int64') {
				if (json < -9223372036854775808 || json > 9223372036854775807) {
					throw new Error('Integer must be within 64-bit range (-2^63 to 2^63-1)');
				}
			}
		}

		if (this.def.min !== undefined) {
			if (this.def.exclusiveMin && json <= this.def.min) {
				throw new Error(`Number must be greater than ${this.def.min}`);
			} else if (!this.def.exclusiveMin && json < this.def.min) {
				throw new Error(`Number must be greater than or equal to ${this.def.min}`);
			}
		}
		if (this.def.max !== undefined) {
			if (this.def.exclusiveMax && json >= this.def.max) {
				throw new Error(`Number must be less than ${this.def.max}`);
			} else if (!this.def.exclusiveMax && json > this.def.max) {
				throw new Error(`Number must be less than or equal to ${this.def.max}`);
			}
		}
		if (this.def.multipleOf !== undefined && json % this.def.multipleOf !== 0) {
			throw new Error(`Number must be a multiple of ${this.def.multipleOf}`);
		}
		return json;
	}

	override serialize(value: number): number {
		return this.parse(value);
	}

	min(min: number, exclusive: boolean = false): this {
		this.def.min = min;
		this.def.exclusiveMin = exclusive;
		return this;
	}

	max(max: number, exclusive: boolean = false): this {
		this.def.max = max;
		this.def.exclusiveMax = exclusive;
		return this;
	}

	integer(): this {
		this.def.integer = true;
		return this;
	}

	format(format: NumberFormat): this {
		this.def.format = format;
		return this;
	}

	multipleOf(value: number): this {
		if (value <= 0) {
			throw new Error('multipleOf must be a positive number');
		}
		this.def.multipleOf = value;
		return this;
	}

	override toOpenAPI(): SchemaObject {
		const schema: SchemaObject = {
			type: this.def.format === 'int32' || this.def.format === 'int64' || this.def.integer ? 'integer' : 'number',
		};
		if (this.def.format) {
			schema.format = this.def.format;
		}
		if (this.def.min !== undefined) {
			if (this.def.exclusiveMin) {
				schema.exclusiveMinimum = this.def.min;
			} else {
				schema.minimum = this.def.min;
			}
		}
		if (this.def.max !== undefined) {
			if (this.def.exclusiveMax) {
				schema.exclusiveMaximum = this.def.max;
			} else {
				schema.maximum = this.def.max;
			}
		}
		if (this.def.multipleOf !== undefined) {
			schema.multipleOf = this.def.multipleOf;
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
	uniqueItems?: boolean;
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
		if (this.def.uniqueItems) {
			const seen = new Set();
			for (const item of json) {
				const key = JSON.stringify(item);
				if (seen.has(key)) {
					throw new Error('Array items must be unique');
				}
				seen.add(key);
			}
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

	uniqueItems(): this {
		this.def.uniqueItems = true;
		return this;
	}

	override toOpenAPI(): SchemaObject {
		return {
			type: 'array',
			items: this.def.items.toOpenAPI(),
			...(this.def.minItems !== undefined ? {minItems: this.def.minItems} : {}),
			...(this.def.maxItems !== undefined ? {maxItems: this.def.maxItems} : {}),
			...(this.def.uniqueItems ? {uniqueItems: true} : {}),
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

export class KNull extends KBaseSchema<null, null> {
	override parse(json: unknown): null {
		if (json !== null) {
			throw new Error('Expected null');
		}
		return null;
	}

	override serialize(value: null): null {
		return value;
	}

	override toOpenAPI(): SchemaObject {
		return {type: 'null'};
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
		if (typeof json !== 'object' || json === null || Array.isArray(json)) {
			throw new Error('Expected object');
		}

		const result: any = {};

		for (const key in this.def.shape) {
			if (Object.prototype.hasOwnProperty.call(this.def.shape, key)) {
				const value = (json as any)[key];
				if (value === undefined) {
					throw new Error(`Missing required property: ${key}`);
				}
				try {
					result[key] = this.def.shape[key]!.parse(value);
				} catch (error: any) {
					throw new Error(`Invalid value for property "${key}": ${error.message}`);
				}
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

	null() {
		return new KNull();
	},

	// Convenience methods for common string formats
	date() {
		return new KString().date();
	},

	dateTime() {
		return new KString().dateTime();
	},

	email() {
		return new KString().email();
	},

	uuid() {
		return new KString().uuid();
	},

	uri() {
		return new KString().uri();
	},

	hostname() {
		return new KString().hostname();
	},

	ipv4() {
		return new KString().ipv4();
	},

	ipv6() {
		return new KString().ipv6();
	},

	password() {
		return new KString().password();
	},

	// Convenience methods for common number formats
	float() {
		return new KNumber().format('float');
	},

	double() {
		return new KNumber().format('double');
	},

	int32() {
		return new KNumber().integer().format('int32');
	},

	int64() {
		return new KNumber().integer().format('int64');
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

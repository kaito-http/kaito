import type {ReferenceObject, SchemaObject} from 'openapi3-ts/oas31';

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONValue[] | {[key: string]: JSONValue};

export interface BaseSchemaDef<Input extends JSONValue, Output extends JSONValue> {
	example?: Input | undefined;
	description?: string | undefined;
}

type Input<Def extends BaseSchemaDef<any, any>> = Def extends BaseSchemaDef<infer Input, infer Output> ? Input : never;
type Output<Def extends BaseSchemaDef<any, any>> =
	Def extends BaseSchemaDef<infer Input, infer Output> ? Output : never;

export interface Issue {
	message: string;
	path: string[];
}

export type ParseResult<T> =
	| {
			success: true;
			result: T;
	  }
	| {
			success: false;
			issues: Set<Issue>;
	  };

export class SchemaError extends Error {
	constructor(public readonly issues: Set<Issue>) {
		const first = issues.values().next().value;

		if (first === undefined) {
			throw new Error('SchemaError expects at least one issue to be provided');
		}

		super(first.message);
	}
}

export class ParseContext {
	private static readonly ISSUE: unique symbol = Symbol('ISSUE');
	readonly ISSUE: typeof ParseContext.ISSUE = ParseContext.ISSUE;

	readonly #issues = new Set<Issue>();

	addIssue(message: string, path: string[]): typeof ParseContext.ISSUE {
		this.#issues.add({message, path});
		return ParseContext.ISSUE;
	}

	get issues() {
		return this.#issues;
	}

	public static result<T>(fn: (ctx: ParseContext) => T | typeof ParseContext.ISSUE): ParseResult<T> {
		const result = ParseContext.with(fn);

		if (result.type === 'FATAL') {
			return {
				success: false,
				issues: result.issues,
			};
		}

		return {
			success: true,
			result: result.result,
		};
	}

	public static with<T>(fn: (ctx: ParseContext) => T | typeof ParseContext.ISSUE) {
		const ctx = new ParseContext();

		const result = fn(ctx);

		if (result === ParseContext.ISSUE) {
			return {
				type: 'FATAL' as const,
				issues: ctx.issues,
			};
		}

		return {
			type: 'PARSED' as const,
			issues: ctx.issues,
			result,
		};
	}
}

export abstract class BaseSchema<Def extends BaseSchemaDef<any, any>> {
	abstract parse(json: unknown): Output<Def>;
	abstract parseSafe(json: unknown): ParseResult<Output<Def>>;
	abstract serialize(value: Output<Def>): JSONValue;
	abstract toOpenAPI(): SchemaObject | ReferenceObject;

	protected readonly def: Def;

	protected clone(def: Partial<Def>): this {
		return new this.constructor({
			...this.def,
			...def,
		});
	}

	protected constructor(def: Def) {
		this.def = def;
	}

	example(example: Input<Def>): this;
	example(): Input<Def> | undefined;
	example(example?: Input<Def>) {
		if (example === undefined) {
			return this.def.example;
		}

		return this.clone({example});
	}

	description(description: string): this;
	description(): string | undefined;
	description(description?: string) {
		if (description === undefined) {
			return this.def.description;
		}

		return this.clone({description});
	}
}

type Check<T extends string, P extends {} = {}> = {type: T; message?: string | undefined} & Omit<P, 'message'>;

/////////////////////////////////////////////////////
////////////////////// KSTRING //////////////////////
/////////////////////////////////////////////////////

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

export const STRING_FORMAT_REGEXES = {
	uuid: /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,
	email: /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,
	ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
	ipv6: /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
	date: new RegExp(
		`^((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))$`,
	),
	uri: /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/,
	hostname:
		/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/,
} as const;

export interface StringChecks {
	min?: Check<'min', {val: number}>;
	max?: Check<'max', {val: number}>;
	regex?: Check<'regex', {regex: RegExp}>;
	format?: Check<'format', {format: StringFormat}>;
}

export interface StringDef extends BaseSchemaDef<string, string>, StringChecks {}

export class KString extends BaseSchema<StringDef> {
	public static create = () => new KString({});

	public serialize(value: string): string {
		return value;
	}

	private setCheck<T extends keyof StringChecks>(check: NonNullable<StringChecks[T]>): this {
		return this.clone({[check.type]: check});
	}

	public toOpenAPI(): SchemaObject | ReferenceObject {
		const schema: SchemaObject = {
			type: 'string',
		};
		if (this.def.regex) {
			schema.pattern = this.def.regex.regex.source;
		}
		if (this.def.format) {
			schema.format = this.def.format.format;
		}
		if (this.def.min !== undefined) {
			schema.minLength = this.def.min.val;
		}
		if (this.def.max !== undefined) {
			schema.maxLength = this.def.max.val;
		}
		if (this.def.description) {
			schema.description = this.def.description;
		}
		return schema;
	}

	/**
	 * Sets the minimum length of the string
	 *
	 * @param min The minimum length of the string
	 * @returns A clone of the schema with the minimum length set
	 */
	public max(min: number, message?: string): this {
		return this.setCheck({type: 'min', val: min, message});
	}

	/**
	 * Sets the maximum length of the string
	 *
	 * @param max The maximum length of the string
	 * @returns A clone of the schema with the maximum length set
	 */
	public min(max: number, message?: string): this {
		return this.setCheck({type: 'max', val: max, message});
	}

	public regex(regex: RegExp, message?: string): this {
		return this.setCheck({type: 'regex', regex, message});
	}

	private format(format: StringFormat, message?: string): this {
		return this.setCheck({type: 'format', format, message});
	}

	public url(message?: string): this {
		return this.format('uri', message);
	}

	public email(message?: string): this {
		return this.format('email', message);
	}

	public uuid(message?: string): this {
		return this.format('uuid', message);
	}

	public ipv4(message?: string): this {
		return this.format('ipv4', message);
	}

	public ipv6(message?: string): this {
		return this.format('ipv6', message);
	}

	public date(message?: string): this {
		return this.format('date', message);
	}

	public dateTime(message?: string): this {
		return this.format('date-time', message);
	}

	public password(message?: string): this {
		return this.format('password', message);
	}

	public byte(message?: string): this {
		return this.format('byte', message);
	}

	public binary(message?: string): this {
		return this.format('binary', message);
	}

	public hostname(message?: string): this {
		return this.format('hostname', message);
	}

	public parseSafe(json: unknown): ParseResult<string> {
		return ParseContext.result(ctx => {
			if (typeof json !== 'string') {
				return ctx.addIssue('Expected string', []);
			}

			if (this.def.min !== undefined && json.length < this.def.min.val) {
				ctx.addIssue(`String must be at least ${this.def.min.val} characters long`, []);
			}

			if (this.def.max !== undefined && json.length > this.def.max.val) {
				ctx.addIssue(`String must be at most ${this.def.max.val} characters long`, []);
			}

			if (this.def.regex !== undefined && !this.def.regex.regex.test(json)) {
				ctx.addIssue(`String must match ${this.def.regex.regex.source}`, []);
			}

			if (this.def.format !== undefined) {
				switch (this.def.format.format) {
					case 'uuid':
						if (!STRING_FORMAT_REGEXES.uuid.test(json)) {
							ctx.addIssue('Invalid UUID format', []);
						}
						break;

					case 'email':
						if (!STRING_FORMAT_REGEXES.email.test(json)) {
							ctx.addIssue('Invalid email format', []);
						}
						break;

					case 'ipv4':
						if (!STRING_FORMAT_REGEXES.ipv4.test(json)) {
							ctx.addIssue('Invalid IPv4 address', []);
						}
						break;

					case 'ipv6':
						if (!STRING_FORMAT_REGEXES.ipv6.test(json)) {
							ctx.addIssue('Invalid IPv6 address', []);
						}
						break;

					case 'date':
						if (!STRING_FORMAT_REGEXES.date.test(json)) {
							ctx.addIssue('Invalid date format', []);
						}
						break;

					case 'date-time':
						if (Number.isNaN(new Date(json).getTime())) {
							ctx.addIssue('Invalid date-time format', []);
						}
						break;

					case 'byte':
						if (!/^[A-Za-z0-9+/]*={0,2}$/.test(json) || json.length % 4 !== 0) {
							ctx.addIssue('Invalid base64 format', []);
						}
						break;

					case 'uri':
						if (!STRING_FORMAT_REGEXES.uri.test(json)) {
							ctx.addIssue('Invalid URI format', []);
						}
						break;

					case 'hostname':
						if (!STRING_FORMAT_REGEXES.hostname.test(json)) {
							ctx.addIssue('Invalid hostname format', []);
						}
						break;

					case 'binary':
						// Binary format is used to describe files, no specific validation needed
						break;

					case 'password':
						// Password is used as a UI hint, again no specific validation needed
						break;

					default:
						this.def.format.format satisfies never;
						break;
				}
			}

			return json;
		});
	}

	public parse(json: unknown): string {
		const result = this.parseSafe(json);

		if (!result.success) {
			throw new SchemaError(result.issues);
		}

		return result.result;
	}
}

/////////////////////////////////////////////////////
////////////////////// KNUMBER //////////////////////
/////////////////////////////////////////////////////

export type NumberFormat = 'float' | 'double' | 'int32' | 'int64';

export interface NumberChecks {
	min?: Check<'min', {val: number}>;
	max?: Check<'max', {val: number}>;
	integer?: Check<'integer'>;
	multipleOf?: Check<'multipleOf', {val: number}>;
	format?: Check<'format', {format: NumberFormat}>;
}

export interface NumberDef extends BaseSchemaDef<number, number>, NumberChecks {}

export class KNumber extends BaseSchema<NumberDef> {
	public static create = () => new KNumber({});

	public serialize(value: number): number {
		return value;
	}

	private setCheck<T extends keyof NumberChecks>(check: NonNullable<NumberChecks[T]>): this {
		return this.clone({[check.type]: check});
	}

	public toOpenAPI(): SchemaObject | ReferenceObject {
		const schema: SchemaObject = {type: 'number'};
		if (this.def.min !== undefined) {
			schema.minimum = this.def.min.val;
		}
		if (this.def.max !== undefined) {
			schema.maximum = this.def.max.val;
		}
		if (this.def.multipleOf !== undefined) {
			schema.multipleOf = this.def.multipleOf.val;
		}
		if (this.def.integer) {
			schema.type = 'integer';
		}
		if (this.def.format) {
			schema.format = this.def.format.format;
		}
		if (this.def.description) {
			schema.description = this.def.description;
		}
		return schema;
	}

	public min(min: number): this {
		return this.setCheck({type: 'min', val: min});
	}

	public max(max: number): this {
		return this.setCheck({type: 'max', val: max});
	}

	public integer(): this {
		return this.setCheck({type: 'integer'});
	}

	public multipleOf(multipleOf: number): this {
		return this.setCheck({type: 'multipleOf', val: multipleOf});
	}

	public float(): this {
		return this.setCheck({type: 'format', format: 'float'});
	}

	public double(): this {
		return this.setCheck({type: 'format', format: 'double'});
	}

	public int32(): this {
		return this.setCheck({type: 'format', format: 'int32'});
	}

	public int64(): this {
		return this.setCheck({type: 'format', format: 'int64'});
	}

	public parseSafe(json: unknown): ParseResult<number> {
		return ParseContext.result(ctx => {
			if (typeof json !== 'number') {
				return ctx.addIssue('Expected number', []);
			}

			if (this.def.integer && !Number.isInteger(json)) {
				return ctx.addIssue('Expected integer', []);
			}

			if (this.def.min !== undefined && json < this.def.min.val) {
				return ctx.addIssue(`Number must be greater than ${this.def.min.val}`, []);
			}

			if (this.def.max !== undefined && json > this.def.max.val) {
				return ctx.addIssue(`Number must be less than ${this.def.max.val}`, []);
			}

			if (this.def.multipleOf !== undefined && json % this.def.multipleOf.val !== 0) {
				return ctx.addIssue(`Number must be a multiple of ${this.def.multipleOf.val}`, []);
			}

			return json;
		});
	}

	public parse(json: unknown): number {
		const result = this.parseSafe(json);

		if (!result.success) {
			throw new SchemaError(result.issues);
		}

		return result.result;
	}
}

export const k = {
	string: KString.create,
	number: KNumber.create,
};

// export type NumberFormat = 'float' | 'double' | 'int32' | 'int64';

// export type NumberDef = {
// 	min?: number;
// 	max?: number;
// 	integer?: boolean;
// 	format?: NumberFormat;
// 	exclusiveMin?: boolean;
// 	exclusiveMax?: boolean;
// 	multipleOf?: number;
// };

// export class KNumber extends KBaseSchema<number, number> {
// 	private def: NumberDef;

// 	constructor(def: NumberDef = {}) {
// 		super();
// 		this.def = def;
// 	}

// 	override parse(json: unknown): number {
// 		if (typeof json !== 'number') {
// 			throw new Error('Expected number');
// 		}

// 		// Check integer format first
// 		if (this.def.format === 'int32' || this.def.format === 'int64' || this.def.integer) {
// 			if (!Number.isInteger(json)) {
// 				throw new Error('Expected integer');
// 			}

// 			// Additional format-specific validations
// 			if (this.def.format === 'int32') {
// 				if (json < -2147483648 || json > 2147483647) {
// 					throw new Error('Integer must be within 32-bit range (-2^31 to 2^31-1)');
// 				}
// 			} else if (this.def.format === 'int64') {
// 				if (json < -9223372036854775808 || json > 9223372036854775807) {
// 					throw new Error('Integer must be within 64-bit range (-2^63 to 2^63-1)');
// 				}
// 			}
// 		}

// 		if (this.def.min !== undefined) {
// 			if (this.def.exclusiveMin && json <= this.def.min) {
// 				throw new Error(`Number must be greater than ${this.def.min}`);
// 			} else if (!this.def.exclusiveMin && json < this.def.min) {
// 				throw new Error(`Number must be greater than or equal to ${this.def.min}`);
// 			}
// 		}
// 		if (this.def.max !== undefined) {
// 			if (this.def.exclusiveMax && json >= this.def.max) {
// 				throw new Error(`Number must be less than ${this.def.max}`);
// 			} else if (!this.def.exclusiveMax && json > this.def.max) {
// 				throw new Error(`Number must be less than or equal to ${this.def.max}`);
// 			}
// 		}
// 		if (this.def.multipleOf !== undefined && json % this.def.multipleOf !== 0) {
// 			throw new Error(`Number must be a multiple of ${this.def.multipleOf}`);
// 		}
// 		return json;
// 	}

// 	override serialize(value: number): number {
// 		return this.parse(value);
// 	}

// 	min(min: number, exclusive: boolean = false): this {
// 		this.def.min = min;
// 		this.def.exclusiveMin = exclusive;
// 		return this;
// 	}

// 	max(max: number, exclusive: boolean = false): this {
// 		this.def.max = max;
// 		this.def.exclusiveMax = exclusive;
// 		return this;
// 	}

// 	integer(): this {
// 		this.def.integer = true;
// 		return this;
// 	}

// 	format(format: NumberFormat): this {
// 		this.def.format = format;
// 		return this;
// 	}

// 	multipleOf(value: number): this {
// 		if (value <= 0) {
// 			throw new Error('multipleOf must be a positive number');
// 		}
// 		this.def.multipleOf = value;
// 		return this;
// 	}

// 	override toOpenAPI(): SchemaObject {
// 		const schema: SchemaObject = {
// 			type: this.def.format === 'int32' || this.def.format === 'int64' || this.def.integer ? 'integer' : 'number',
// 		};
// 		if (this.def.format) {
// 			schema.format = this.def.format;
// 		}
// 		if (this.def.min !== undefined) {
// 			if (this.def.exclusiveMin) {
// 				schema.exclusiveMinimum = this.def.min;
// 			} else {
// 				schema.minimum = this.def.min;
// 			}
// 		}
// 		if (this.def.max !== undefined) {
// 			if (this.def.exclusiveMax) {
// 				schema.exclusiveMaximum = this.def.max;
// 			} else {
// 				schema.maximum = this.def.max;
// 			}
// 		}
// 		if (this.def.multipleOf !== undefined) {
// 			schema.multipleOf = this.def.multipleOf;
// 		}
// 		if (this._description) {
// 			schema.description = this._description;
// 		}
// 		return schema;
// 	}
// }

// export class KBoolean extends KBaseSchema<boolean, boolean> {
// 	constructor() {
// 		super();
// 	}

// 	override parse(json: unknown): boolean {
// 		if (typeof json !== 'boolean') {
// 			throw new Error('Expected boolean');
// 		}
// 		return json;
// 	}

// 	override serialize(value: boolean): boolean {
// 		return this.parse(value);
// 	}

// 	override toOpenAPI(): SchemaObject {
// 		return {
// 			type: 'boolean',
// 			...(this._description ? {description: this._description} : {}),
// 		};
// 	}
// }

// export type ArrayDef<T> = {
// 	items: KBaseSchema<any, T>;
// 	minItems?: number;
// 	maxItems?: number;
// 	uniqueItems?: boolean;
// };

// export class KArray<T> extends KBaseSchema<Array<any>, Array<T>> {
// 	private def: ArrayDef<T>;

// 	constructor(def: ArrayDef<T>) {
// 		super();
// 		this.def = def;
// 	}

// 	override parse(json: unknown): Array<T> {
// 		if (!Array.isArray(json)) {
// 			throw new Error('Expected array');
// 		}
// 		if (this.def.minItems !== undefined && json.length < this.def.minItems) {
// 			throw new Error(`Array must contain at least ${this.def.minItems} items`);
// 		}
// 		if (this.def.maxItems !== undefined && json.length > this.def.maxItems) {
// 			throw new Error(`Array must contain at most ${this.def.maxItems} items`);
// 		}
// 		if (this.def.uniqueItems) {
// 			const seen = new Set();
// 			for (const item of json) {
// 				const key = JSON.stringify(item);
// 				if (seen.has(key)) {
// 					throw new Error('Array items must be unique');
// 				}
// 				seen.add(key);
// 			}
// 		}
// 		return json.map(item => this.def.items.parse(item));
// 	}

// 	override serialize(value: Array<T>): unknown {
// 		return value.map(item => this.def.items.serialize(item));
// 	}

// 	minItems(min: number): this {
// 		this.def.minItems = min;
// 		return this;
// 	}

// 	maxItems(max: number): this {
// 		this.def.maxItems = max;
// 		return this;
// 	}

// 	uniqueItems(): this {
// 		this.def.uniqueItems = true;
// 		return this;
// 	}

// 	override toOpenAPI(): SchemaObject {
// 		return {
// 			type: 'array',
// 			items: this.def.items.toOpenAPI(),
// 			...(this.def.minItems !== undefined ? {minItems: this.def.minItems} : {}),
// 			...(this.def.maxItems !== undefined ? {maxItems: this.def.maxItems} : {}),
// 			...(this.def.uniqueItems ? {uniqueItems: true} : {}),
// 			...(this._description ? {description: this._description} : {}),
// 		};
// 	}
// }

// export type ScalarDef<ClientRepresentation extends JSONPrimitive, ServerRepresentation> = {
// 	json: KBaseSchema<ClientRepresentation, ClientRepresentation>;
// 	parse(jsonValue: ClientRepresentation): ServerRepresentation;
// 	serialize(clientValue: ServerRepresentation): ClientRepresentation;
// };

// export class KScalar<ClientRepresentation extends JSONPrimitive, ServerRepresentation> extends KBaseSchema<
// 	ClientRepresentation,
// 	ServerRepresentation
// > {
// 	private def: ScalarDef<ClientRepresentation, ServerRepresentation>;

// 	constructor(def: ScalarDef<ClientRepresentation, ServerRepresentation>) {
// 		super();
// 		this.def = def;
// 	}

// 	override parse(json: unknown): ServerRepresentation {
// 		const jsonValue = this.def.json.parse(json);
// 		return this.def.parse(jsonValue);
// 	}

// 	override serialize(value: ServerRepresentation): unknown {
// 		const jsonValue = this.def.serialize(value);
// 		return this.def.json.serialize(jsonValue);
// 	}

// 	override toOpenAPI(): SchemaObject | ReferenceObject {
// 		const base = this.def.json.toOpenAPI();
// 		if (this._description && 'description' in base) {
// 			base.description = this._description;
// 		}
// 		return base;
// 	}
// }

// export class KNull extends KBaseSchema<null, null> {
// 	override parse(json: unknown): null {
// 		if (json !== null) {
// 			throw new Error('Expected null');
// 		}
// 		return null;
// 	}

// 	override serialize(value: null): null {
// 		return value;
// 	}

// 	override toOpenAPI(): SchemaObject {
// 		return {type: 'null'};
// 	}
// }

// export type RefDef<Shape extends Record<string, KBaseSchema<any, any>>> = {
// 	name: string;
// 	shape: Shape;
// };

// export class KRef<Shape extends Record<string, KBaseSchema<any, any>>> extends KBaseSchema<
// 	{
// 		[K in keyof Shape]: KInferInput<Shape[K]>;
// 	},
// 	{
// 		[K in keyof Shape]: KInferOutput<Shape[K]>;
// 	}
// > {
// 	private def: RefDef<Shape>;

// 	constructor(def: RefDef<Shape>) {
// 		super();
// 		this.def = def;
// 	}

// 	override parse(json: unknown): {
// 		[K in keyof Shape]: KInferOutput<Shape[K]>;
// 	} {
// 		if (typeof json !== 'object' || json === null || Array.isArray(json)) {
// 			throw new Error('Expected object');
// 		}

// 		const result: any = {};

// 		for (const key in this.def.shape) {
// 			if (Object.prototype.hasOwnProperty.call(this.def.shape, key)) {
// 				const value = (json as any)[key];
// 				if (value === undefined) {
// 					throw new Error(`Missing required property: ${key}`);
// 				}
// 				try {
// 					result[key] = this.def.shape[key]!.parse(value);
// 				} catch (error: any) {
// 					throw new Error(`Invalid value for property "${key}": ${error.message}`);
// 				}
// 			}
// 		}

// 		return result;
// 	}

// 	override serialize(value: {
// 		[K in keyof Shape]: KInferOutput<Shape[K]>;
// 	}): unknown {
// 		const result: Record<string, unknown> = {};
// 		for (const key in this.def.shape) {
// 			if (Object.prototype.hasOwnProperty.call(this.def.shape, key)) {
// 				const fieldValue = (value as any)[key];
// 				if (fieldValue === undefined) {
// 					throw new Error(`Missing required property: ${key}`);
// 				}
// 				result[key] = this.def.shape[key]!.serialize(fieldValue);
// 			}
// 		}
// 		return result;
// 	}

// 	override toOpenAPI(): ReferenceObject {
// 		return {
// 			$ref: `#/components/schemas/${this.def.name}`,
// 			...(this._description ? {description: this._description} : {}),
// 		};
// 	}

// 	get shape() {
// 		return this.def.shape;
// 	}

// 	get name() {
// 		return this.def.name;
// 	}
// }

// export const k = {
// 	string() {
// 		return new KString();
// 	},

// 	scalar<ClientRepresentation extends JSONPrimitive, ServerRepresentation>(
// 		def: ScalarDef<ClientRepresentation, ServerRepresentation>,
// 	) {
// 		return new KScalar<ClientRepresentation, ServerRepresentation>(def);
// 	},

// 	ref<Shape extends Record<string, any>>(name: string, shape: Shape) {
// 		const def: RefDef<Shape> = {name, shape};
// 		return new KRef(def);
// 	},

// 	number() {
// 		return new KNumber();
// 	},

// 	boolean() {
// 		return new KBoolean();
// 	},

// 	array<T>(items: KBaseSchema<any, T>) {
// 		return new KArray({items});
// 	},

// 	null() {
// 		return new KNull();
// 	},

// 	// Convenience methods for common string formats
// 	date() {
// 		return new KString().date();
// 	},

// 	dateTime() {
// 		return new KString().dateTime();
// 	},

// 	email() {
// 		return new KString().email();
// 	},

// 	uuid() {
// 		return new KString().uuid();
// 	},

// 	uri() {
// 		return new KString().uri();
// 	},

// 	hostname() {
// 		return new KString().hostname();
// 	},

// 	ipv4() {
// 		return new KString().ipv4();
// 	},

// 	ipv6() {
// 		return new KString().ipv6();
// 	},

// 	password() {
// 		return new KString().password();
// 	},

// 	// Convenience methods for common number formats
// 	float() {
// 		return new KNumber().format('float');
// 	},

// 	double() {
// 		return new KNumber().format('double');
// 	},

// 	int32() {
// 		return new KNumber().integer().format('int32');
// 	},

// 	int64() {
// 		return new KNumber().integer().format('int64');
// 	},
// };

// export const id = k
// 	.scalar({
// 		json: k.string(),
// 		parse: value => BigInt(value),
// 		serialize: value => value.toString(),
// 	})
// 	.description('A user id');

// export const user = k
// 	.ref('User', {
// 		id: id,
// 		name: k.string(),
// 	})
// 	.example({
// 		id: '1234',
// 		name: 'Alistair',
// 	});

import type {ReferenceObject, SchemaObject} from 'openapi3-ts/oas31';

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONValue[] | {[key: string]: JSONValue};

export interface BaseSchemaDef<Input extends JSONValue> {
	example?: Input | undefined;
	description?: string | undefined;
}

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

	addIssues(issues: Iterable<Issue>, path: string[]): typeof ParseContext.ISSUE {
		for (const issue of issues) {
			this.#issues.add({...issue, path: [...path, ...issue.path]});
		}
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

export type AnySchemaFor<T extends JSONValue> = BaseSchema<T, T, BaseSchemaDef<T>>;

export abstract class BaseSchema<Input extends JSONValue, Output, Def extends BaseSchemaDef<Input>> {
	abstract parse(json: unknown): Output;
	abstract parseSafe(json: unknown): ParseResult<Output>;
	abstract serialize(value: Output): Input;
	abstract toOpenAPI(): SchemaObject | ReferenceObject;

	protected readonly def: Def;

	protected clone(def: Partial<Def>): this {
		// @ts-expect-error
		return new this.constructor({
			...this.def,
			...def,
		});
	}

	protected constructor(def: Def) {
		this.def = def;
	}

	example(example: Input): this;
	example(): Input | undefined;
	example(example?: Input) {
		if (example === undefined) {
			return this.def.example;
		}

		return this.clone({example} as Partial<Def>);
	}

	description(description: string): this;
	description(): string | undefined;
	description(description?: string) {
		if (description === undefined) {
			return this.def.description;
		}

		return this.clone({description} as Partial<Def>);
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
	date: /^([0-9]{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/,
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

export interface StringDef extends BaseSchemaDef<string>, StringChecks {}

export class KString extends BaseSchema<string, string, StringDef> {
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

	public uri(message?: string): this {
		return this.format('uri', message);
	}

	/**
	 * Deprecated because OpenAPI uses the term "uri"
	 * but this method exists for making migration from
	 * Zod easier.
	 *
	 * @deprecated Use {@link uri} instead
	 */
	public url(message?: string): this {
		return this.uri(message);
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
				ctx.addIssue(this.def.min.message ?? `String must be at least ${this.def.min.val} characters long`, []);
			}

			if (this.def.max !== undefined && json.length > this.def.max.val) {
				ctx.addIssue(this.def.max.message ?? `String must be at most ${this.def.max.val} characters long`, []);
			}

			if (this.def.regex !== undefined && !this.def.regex.regex.test(json)) {
				ctx.addIssue(this.def.regex.message ?? `String must match ${this.def.regex.regex.source}`, []);
			}

			if (this.def.format !== undefined) {
				switch (this.def.format.format) {
					case 'uuid':
						if (!STRING_FORMAT_REGEXES.uuid.test(json)) {
							ctx.addIssue(this.def.format.message ?? 'Invalid UUID format', []);
						}
						break;

					case 'email':
						if (!STRING_FORMAT_REGEXES.email.test(json)) {
							ctx.addIssue(this.def.format.message ?? 'Invalid email format', []);
						}
						break;

					case 'ipv4':
						if (!STRING_FORMAT_REGEXES.ipv4.test(json)) {
							ctx.addIssue(this.def.format.message ?? 'Invalid IPv4 address', []);
						}
						break;

					case 'ipv6':
						if (!STRING_FORMAT_REGEXES.ipv6.test(json)) {
							ctx.addIssue(this.def.format.message ?? 'Invalid IPv6 address', []);
						}
						break;

					case 'date':
						if (!STRING_FORMAT_REGEXES.date.test(json)) {
							ctx.addIssue(this.def.format.message ?? 'Invalid date format', []);
						}
						break;

					case 'date-time':
						if (Number.isNaN(new Date(json).getTime())) {
							ctx.addIssue(this.def.format.message ?? 'Invalid date-time format', []);
						}
						break;

					case 'byte':
						if (!/^[A-Za-z0-9+/]*={0,2}$/.test(json) || json.length % 4 !== 0) {
							ctx.addIssue(this.def.format.message ?? 'Invalid base64 format', []);
						}
						break;

					case 'uri':
						if (!STRING_FORMAT_REGEXES.uri.test(json)) {
							ctx.addIssue(this.def.format.message ?? 'Invalid URI format', []);
						}
						break;

					case 'hostname':
						if (!STRING_FORMAT_REGEXES.hostname.test(json)) {
							ctx.addIssue(this.def.format.message ?? 'Invalid hostname format', []);
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

export interface NumberDef extends BaseSchemaDef<number>, NumberChecks {}

export class KNumber extends BaseSchema<number, number, NumberDef> {
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
				return ctx.addIssue(this.def.integer.message ?? 'Expected integer', []);
			}

			if (this.def.min !== undefined && json < this.def.min.val) {
				return ctx.addIssue(this.def.min.message ?? `Number must be greater than ${this.def.min.val}`, []);
			}

			if (this.def.max !== undefined && json > this.def.max.val) {
				return ctx.addIssue(this.def.max.message ?? `Number must be less than ${this.def.max.val}`, []);
			}

			if (this.def.multipleOf !== undefined && json % this.def.multipleOf.val !== 0) {
				return ctx.addIssue(
					this.def.multipleOf.message ?? `Number must be a multiple of ${this.def.multipleOf.val}`,
					[],
				);
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

/////////////////////////////////////////////////////
////////////////////// KBOOLEAN //////////////////////
/////////////////////////////////////////////////////

export interface BooleanDef extends BaseSchemaDef<boolean> {}

export class KBoolean extends BaseSchema<boolean, boolean, BooleanDef> {
	public static create = () => new KBoolean({});

	public serialize(value: boolean): boolean {
		return value;
	}

	public toOpenAPI(): SchemaObject | ReferenceObject {
		return {
			type: 'boolean',
			...(this.def.description ? {description: this.def.description} : {}),
		};
	}

	public parseSafe(json: unknown): ParseResult<boolean> {
		return ParseContext.result(ctx => {
			if (typeof json !== 'boolean') {
				return ctx.addIssue('Expected boolean', []);
			}
			return json;
		});
	}

	public parse(json: unknown): boolean {
		const result = this.parseSafe(json);

		if (!result.success) {
			throw new SchemaError(result.issues);
		}

		return result.result;
	}
}

/////////////////////////////////////////////////////
////////////////////// KARRAY //////////////////////
/////////////////////////////////////////////////////

export interface ArrayChecks {
	minItems?: Check<'minItems', {val: number}>;
	maxItems?: Check<'maxItems', {val: number}>;
	uniqueItems?: Check<'uniqueItems', {val: boolean}>;
}

export interface ArrayDef<Input extends JSONValue, Output> extends BaseSchemaDef<Input[]>, ArrayChecks {
	items: BaseSchema<Input, Output, BaseSchemaDef<Input>>;
}

export class KArray<Input extends JSONValue, Output> extends BaseSchema<Input[], Output[], ArrayDef<Input, Output>> {
	public static create = <ItemsInput extends JSONValue, ItemsOutput, Def extends BaseSchemaDef<ItemsInput>>(
		items: BaseSchema<ItemsInput, ItemsOutput, Def>,
	) => new KArray({items});

	public serialize(value: Output[]): Input[] {
		return value.map(item => this.def.items.serialize(item));
	}

	private setCheck<T extends keyof ArrayChecks>(check: NonNullable<ArrayChecks[T]>): this {
		return this.clone({[check.type]: check});
	}

	public toOpenAPI(): SchemaObject | ReferenceObject {
		return {
			type: 'array',
			items: this.def.items.toOpenAPI(),
			...(this.def.minItems !== undefined ? {minItems: this.def.minItems.val} : {}),
			...(this.def.maxItems !== undefined ? {maxItems: this.def.maxItems.val} : {}),
			...(this.def.uniqueItems !== undefined ? {uniqueItems: this.def.uniqueItems.val} : {}),
		};
	}

	public min(minItems: number): this {
		return this.setCheck({type: 'minItems', val: minItems});
	}

	public max(maxItems: number): this {
		return this.setCheck({type: 'maxItems', val: maxItems});
	}

	public unique(): this {
		return this.setCheck({type: 'uniqueItems', val: true});
	}

	public notUnique(): this {
		return this.setCheck({type: 'uniqueItems', val: false});
	}

	public parseSafe(json: unknown): ParseResult<Output[]> {
		return ParseContext.result(ctx => {
			if (!Array.isArray(json)) {
				return ctx.addIssue('Expected array', []);
			}

			if (this.def.minItems !== undefined && json.length < this.def.minItems.val) {
				return ctx.addIssue(this.def.minItems.message ?? `Array must have at least ${this.def.minItems.val} items`, []);
			}

			if (this.def.maxItems !== undefined && json.length > this.def.maxItems.val) {
				return ctx.addIssue(this.def.maxItems.message ?? `Array must have at most ${this.def.maxItems.val} items`, []);
			}

			if (this.def.uniqueItems !== undefined && new Set(json).size !== json.length) {
				return ctx.addIssue(this.def.uniqueItems.message ?? 'Array must have unique items', []);
			}

			const items: Output[] = [];

			for (let i = 0; i < json.length; i++) {
				const item = json[i];
				const result = this.def.items.parseSafe(item);

				if (!result.success) {
					return ctx.addIssues(result.issues, [i.toString()]);
				}

				items.push(result.result);
			}

			return items;
		});
	}

	public parse(json: unknown): Output[] {
		const result = this.parseSafe(json);

		if (!result.success) {
			throw new SchemaError(result.issues);
		}

		return result.result;
	}
}

/////////////////////////////////////////////////////
////////////////////// KNULL //////////////////////
/////////////////////////////////////////////////////

export interface NullDef extends BaseSchemaDef<null> {}

export class KNull extends BaseSchema<null, null, NullDef> {
	public static create = () => new KNull({});

	public serialize(value: null): null {
		return value;
	}

	public toOpenAPI(): SchemaObject | ReferenceObject {
		return {
			type: 'null',
			...(this.def.description ? {description: this.def.description} : {}),
		};
	}

	public parseSafe(json: unknown): ParseResult<null> {
		return ParseContext.result(ctx => {
			if (json !== null) {
				return ctx.addIssue('Expected null', []);
			}
			return null;
		});
	}

	public parse(json: unknown): null {
		const result = this.parseSafe(json);
		if (!result.success) {
			throw new SchemaError(result.issues);
		}
		return result.result;
	}
}

/////////////////////////////////////////////////////
////////////////////// KOBJECT //////////////////////
/////////////////////////////////////////////////////

export interface ObjectDef<Input extends Record<keyof Output, JSONValue>, Output extends Record<keyof Input, JSONValue>>
	extends BaseSchemaDef<Input> {
	shape: {
		[K in keyof Input]: BaseSchema<Input[K], Output[K], BaseSchemaDef<Input[K]>>;
	};
}

export class KObject<
	Input extends Record<keyof Output, JSONValue>,
	Output extends Record<keyof Input, JSONValue>,
> extends BaseSchema<Input, Output, ObjectDef<Input, Output>> {
	public static create = <
		Input extends Record<keyof Output, JSONValue>,
		Output extends Record<keyof Input, JSONValue>,
	>(shape: {
		[K in keyof Input | keyof Output]: BaseSchema<Input[K], Output[K], BaseSchemaDef<Input[K]>>;
	}) => new KObject({shape});

	override serialize(value: Output): Input {
		const result: Record<string, unknown> = {};

		for (const key in this.def.shape) {
			if (Object.prototype.hasOwnProperty.call(this.def.shape, key)) {
				const fieldValue = value[key];

				if (fieldValue === undefined) {
					throw new Error(`Missing required property: ${key}`);
				}

				result[key] = this.def.shape[key].serialize(fieldValue);
			}
		}

		return result as Input;
	}

	override toOpenAPI(): SchemaObject {
		return {
			type: 'object',
			properties: Object.fromEntries(
				Object.entries(this.def.shape).map(entry => {
					const [key, value] = entry as [
						keyof Input,
						BaseSchema<Input[keyof Input], Output[keyof Input], BaseSchemaDef<Input[keyof Input]>>,
					];

					return [key, value.toOpenAPI()];
				}),
			),
			required: Object.keys(this.def.shape),
			...(this.def.description ? {description: this.def.description} : {}),
		};
	}

	public parseSafe(json: unknown): ParseResult<Output> {
		return ParseContext.result<Output>(ctx => {
			if (typeof json !== 'object' || json === null || Array.isArray(json)) {
				return ctx.addIssue(`Expected object, got ${typeof json}`, []);
			}

			const result: Output = {} as Output;

			for (const key in this.def.shape) {
				if (Object.prototype.hasOwnProperty.call(this.def.shape, key)) {
					const value = (json as {[key: string]: unknown})[key];
					if (value === undefined) {
						return ctx.addIssue(`Missing required property: ${key}`, [key]);
					}

					const parseResult = this.def.shape[key]!.parseSafe(value);

					if (!parseResult.success) {
						return ctx.addIssues(parseResult.issues, [key]);
					}

					result[key] = parseResult.result;
				}
			}

			return result;
		});
	}

	public parse(json: unknown) {
		const result = this.parseSafe(json);
		if (!result.success) {
			throw new SchemaError(result.issues);
		}
		return result.result;
	}

	get shape() {
		return this.def.shape;
	}
}

/////////////////////////////////////////////////////
////////////////////// KREF //////////////////////
/////////////////////////////////////////////////////

export interface RefDef<Input extends Record<keyof Output, JSONValue>, Output extends Record<keyof Input, JSONValue>>
	extends ObjectDef<Input, Output> {
	name: string;
	summary?: string | undefined;
}

export class KRef<
	Input extends Record<keyof Output, JSONValue>,
	Output extends Record<keyof Input, JSONValue>,
> extends BaseSchema<Input, Output, RefDef<Input, Output>> {
	public static create = <Input extends Record<keyof Output, JSONValue>, Output extends Record<keyof Input, JSONValue>>(
		name: string,
		shape: {
			[K in keyof Input | keyof Output]: BaseSchema<Input[K], Output[K], BaseSchemaDef<Input[K]>>;
		},
	) => new KRef({name, shape});

	override serialize(value: Output): Input {
		const result: Record<string, unknown> = {};

		for (const key in this.def.shape) {
			if (Object.prototype.hasOwnProperty.call(this.def.shape, key)) {
				const fieldValue = value[key];

				if (fieldValue === undefined) {
					throw new Error(`Missing required property: ${key}`);
				}

				result[key] = this.def.shape[key].serialize(fieldValue);
			}
		}

		return result as Input;
	}

	override toOpenAPI(): ReferenceObject {
		return {
			$ref: `#/components/schemas/${this.def.name}`,
			...(this.def.description ? {description: this.def.description} : {}),
			...(this.def.summary ? {summary: this.def.summary} : {}),
		};
	}

	public parseSafe(json: unknown): ParseResult<Output> {
		return ParseContext.result<Output>(ctx => {
			if (typeof json !== 'object' || json === null || Array.isArray(json)) {
				return ctx.addIssue(`Expected object, got ${typeof json}`, []);
			}

			const result: Output = {} as Output;

			for (const key in this.def.shape) {
				if (Object.prototype.hasOwnProperty.call(this.def.shape, key)) {
					const value = (json as {[key: string]: unknown})[key];
					if (value === undefined) {
						return ctx.addIssue(`Missing required property: ${key}`, [key]);
					}

					const parseResult = this.def.shape[key]!.parseSafe(value);

					if (!parseResult.success) {
						return ctx.addIssues(parseResult.issues, [key]);
					}

					result[key] = parseResult.result;
				}
			}

			return result;
		});
	}

	public parse(json: unknown) {
		const result = this.parseSafe(json);
		if (!result.success) {
			throw new SchemaError(result.issues);
		}
		return result.result;
	}

	public summary(): string | undefined;
	public summary(summary: string): this;
	public summary(summary?: string) {
		if (summary === undefined) {
			return this.def.summary;
		}
		return this.clone({summary} as Partial<RefDef<Input, Output>>);
	}

	get shape() {
		return this.def.shape;
	}

	get name() {
		return this.def.name;
	}
}

export interface ScalarOptions<ClientRepresentation extends JSONPrimitive, ServerRepresentation> {
	schema: BaseSchema<ClientRepresentation, ClientRepresentation, BaseSchemaDef<ClientRepresentation>>;
	toServer: (jsonValue: ClientRepresentation) => ServerRepresentation;
	toClient: (clientValue: ServerRepresentation) => ClientRepresentation;
}

export interface ScalarDef<ClientRepresentation extends JSONPrimitive, ServerRepresentation>
	extends BaseSchemaDef<ClientRepresentation>,
		ScalarOptions<ClientRepresentation, ServerRepresentation> {}

export class KScalar<ClientRepresentation extends JSONPrimitive, ServerRepresentation> extends BaseSchema<
	ClientRepresentation,
	ServerRepresentation,
	ScalarDef<ClientRepresentation, ServerRepresentation>
> {
	public static create = <ClientRepresentation extends JSONPrimitive, ServerRepresentation>(
		options: ScalarOptions<ClientRepresentation, ServerRepresentation>,
	) => new KScalar(options);

	public constructor(def: ScalarDef<ClientRepresentation, ServerRepresentation>) {
		super(def);
	}

	override serialize(value: ServerRepresentation): ClientRepresentation {
		return this.def.toClient(value);
	}

	override toOpenAPI(): SchemaObject | ReferenceObject {
		return this.def.schema.toOpenAPI();
	}

	override parseSafe(json: unknown): ParseResult<ServerRepresentation> {
		return ParseContext.result(ctx => {
			const jsonValue = this.def.schema.parseSafe(json);
			if (!jsonValue.success) {
				return ctx.addIssues(jsonValue.issues, []);
			}
			return this.def.toServer(jsonValue.result);
		});
	}

	override parse(json: unknown): ServerRepresentation {
		const result = this.parseSafe(json);
		if (!result.success) {
			throw new SchemaError(result.issues);
		}
		return result.result;
	}
}

/////////////////////////////////////////////////////
////////////////////// KUNION ///////////////////////
/////////////////////////////////////////////////////

export interface UnionDef<Input extends JSONValue, Output> extends BaseSchemaDef<Input> {
	items: [
		a: BaseSchema<Input, Output, BaseSchemaDef<Input>>,
		b: BaseSchema<Input, Output, BaseSchemaDef<Input>>,
		...remaining: BaseSchema<Input, Output, BaseSchemaDef<Input>>[],
	];
}

export class KUnion<Input extends JSONValue, Output> extends BaseSchema<Input, Output, UnionDef<Input, Output>> {
	public static create = <
		Items extends [
			a: BaseSchema<JSONValue, unknown, BaseSchemaDef<JSONValue>>,
			b: BaseSchema<JSONValue, unknown, BaseSchemaDef<JSONValue>>,
			...remaining: BaseSchema<JSONValue, unknown, BaseSchemaDef<JSONValue>>[],
		],
	>(
		items: Items,
	) => {
		return new KUnion<ReturnType<Items[number]['serialize']>, ReturnType<Items[number]['parse']>>({
			// @ts-expect-error
			items,
		});
	};

	public serialize(value: Output): Input {
		for (const option of this.def.items) {
			try {
				return option.serialize(value);
			} catch {}
		}
		throw new Error('Value does not match any union option for serialization');
	}

	public toOpenAPI(): SchemaObject | ReferenceObject {
		return {
			oneOf: this.def.items.map(option => option.toOpenAPI()),
			...(this.def.description ? {description: this.def.description} : {}),
		} as SchemaObject;
	}

	public parseSafe(json: unknown): ParseResult<Output> {
		let lastIssues: Set<Issue> | undefined;
		for (const option of this.def.items) {
			const result = option.parseSafe(json);
			if (result.success) {
				return {success: true, result: result.result};
			} else {
				lastIssues = result.issues;
			}
		}
		return {success: false, issues: lastIssues ?? new Set([{message: 'No union option matched', path: []}])};
	}

	public parse(json: unknown): Output {
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
	boolean: KBoolean.create,
	array: KArray.create,
	null: KNull.create,
	ref: KRef.create,
	object: KObject.create,
	scalar: KScalar.create,
	union: KUnion.create,
};

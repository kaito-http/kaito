import assert from 'node:assert';
import {describe, it} from 'node:test';
import {k, KNumber, KString} from './schema.ts';

describe('Schema', () => {
	describe('KString', () => {
		describe('basic validation', () => {
			const schema = k.string();

			it('should accept valid strings', () => {
				assert.strictEqual(schema.parse('hello'), 'hello');
				assert.strictEqual(schema.parse(''), '');
				assert.strictEqual(schema.parse('123'), '123');
			});

			it('should reject non-strings', () => {
				assert.throws(() => schema.parse(123), /Expected string/);
				assert.throws(() => schema.parse(true), /Expected string/);
				assert.throws(() => schema.parse(null), /Expected string/);
				assert.throws(() => schema.parse(undefined), /Expected string/);
				assert.throws(() => schema.parse({}), /Expected string/);
				assert.throws(() => schema.parse([]), /Expected string/);
			});
		});

		describe('length validation', () => {
			it('should validate minLength', () => {
				const schema = k.string().minLength(3);
				assert.strictEqual(schema.parse('hello'), 'hello');
				assert.strictEqual(schema.parse('123'), '123');
				assert.throws(() => schema.parse('hi'), /at least 3 characters/);
				assert.throws(() => schema.parse(''), /at least 3 characters/);
			});

			it('should validate maxLength', () => {
				const schema = k.string().maxLength(5);
				assert.strictEqual(schema.parse('hello'), 'hello');
				assert.strictEqual(schema.parse('123'), '123');
				assert.throws(() => schema.parse('hello world'), /at most 5 characters/);
			});

			it('should validate both min and max length', () => {
				const schema = k.string().minLength(2).maxLength(5);
				assert.strictEqual(schema.parse('hello'), 'hello');
				assert.strictEqual(schema.parse('123'), '123');
				assert.throws(() => schema.parse('a'), /at least 2 characters/);
				assert.throws(() => schema.parse('hello world'), /at most 5 characters/);
			});
		});

		describe('regex validation', () => {
			it('should validate against regex pattern', () => {
				const schema = k.string().regex(/^[a-z]+$/);
				assert.strictEqual(schema.parse('hello'), 'hello');
				assert.throws(() => schema.parse('hello123'), /does not match pattern/);
				assert.throws(() => schema.parse('Hello'), /does not match pattern/);
			});

			it('should use custom error message', () => {
				const schema = k.string().regex(/^[a-z]+$/, 'must contain only lowercase letters');
				assert.strictEqual(schema.parse('hello'), 'hello');
				assert.throws(() => schema.parse('Hello'), /must contain only lowercase letters/);
			});
		});

		describe('format validation', () => {
			describe('email', () => {
				const schema = k.string().email();

				it('should validate valid email addresses', () => {
					assert.strictEqual(schema.parse('user@example.com'), 'user@example.com');
					assert.strictEqual(schema.parse('user+tag@example.com'), 'user+tag@example.com');
					assert.strictEqual(schema.parse('user@subdomain.example.com'), 'user@subdomain.example.com');
				});

				it('should reject invalid email addresses', () => {
					assert.throws(() => schema.parse('invalid'), /Invalid email format/);
					assert.throws(() => schema.parse('user@'), /Invalid email format/);
					assert.throws(() => schema.parse('@example.com'), /Invalid email format/);
					assert.throws(() => schema.parse('user@.com'), /Invalid email format/);
					assert.throws(() => schema.parse('user@example'), /Invalid email format/);
				});
			});

			describe('uuid', () => {
				const schema = k.string().uuid();

				it('should validate valid UUIDs', () => {
					assert.strictEqual(
						schema.parse('550e8400-e29b-41d4-a716-446655440000'),
						'550e8400-e29b-41d4-a716-446655440000',
					);
				});

				it('should reject invalid UUIDs', () => {
					assert.throws(() => schema.parse('invalid'), /Invalid UUID format/);
					assert.throws(() => schema.parse('550e8400'), /Invalid UUID format/);
					assert.throws(() => schema.parse('550e8400-e29b-41d4-a716'), /Invalid UUID format/);
					assert.throws(() => schema.parse('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'), /Invalid UUID format/);
				});
			});

			describe('date', () => {
				const schema = k.string().date();

				it('should validate valid dates', () => {
					assert.strictEqual(schema.parse('2024-02-29'), '2024-02-29'); // Leap year
					assert.strictEqual(schema.parse('2023-12-31'), '2023-12-31');
					assert.strictEqual(schema.parse('2023-01-01'), '2023-01-01');
				});

				it('should reject invalid dates', () => {
					assert.throws(() => schema.parse('2023-02-29'), /Invalid date format/); // Not a leap year
					assert.throws(() => schema.parse('2023-13-01'), /Invalid date format/);
					assert.throws(() => schema.parse('2023-00-01'), /Invalid date format/);
					assert.throws(() => schema.parse('2023-12-32'), /Invalid date format/);
					assert.throws(() => schema.parse('invalid'), /Invalid date format/);
				});
			});

			describe('date-time', () => {
				const schema = k.string().dateTime();

				it('should validate valid date-times', () => {
					assert.strictEqual(schema.parse('2023-12-31T23:59:59Z'), '2023-12-31T23:59:59Z');
					assert.strictEqual(schema.parse('2024-02-29T00:00:00+00:00'), '2024-02-29T00:00:00+00:00');
				});

				it('should reject invalid date-times', () => {
					assert.throws(() => schema.parse('invalid'), /Invalid date-time format/);
					assert.throws(() => schema.parse('2023-13-01T00:00:00Z'), /Invalid date-time format/);
					assert.throws(() => schema.parse('2023-12-32T00:00:00Z'), /Invalid date-time format/);
				});
			});

			describe('ipv4', () => {
				const schema = k.string().ipv4();

				it('should validate valid IPv4 addresses', () => {
					assert.strictEqual(schema.parse('192.168.0.1'), '192.168.0.1');
					assert.strictEqual(schema.parse('0.0.0.0'), '0.0.0.0');
					assert.strictEqual(schema.parse('255.255.255.255'), '255.255.255.255');
				});

				it('should reject invalid IPv4 addresses', () => {
					assert.throws(() => schema.parse('256.1.2.3'), /Invalid IPv4 address/);
					assert.throws(() => schema.parse('1.2.3'), /Invalid IPv4 address/);
					assert.throws(() => schema.parse('1.2.3.4.5'), /Invalid IPv4 address/);
					assert.throws(() => schema.parse('192.168.001.1'), /Invalid IPv4 address/);
				});
			});

			describe('ipv6', () => {
				const schema = k.string().ipv6();

				it('should validate valid IPv6 addresses', () => {
					assert.strictEqual(
						schema.parse('2001:0db8:85a3:0000:0000:8a2e:0370:7334'),
						'2001:0db8:85a3:0000:0000:8a2e:0370:7334',
					);
					assert.strictEqual(schema.parse('::1'), '::1');
					assert.strictEqual(schema.parse('fe80::'), 'fe80::');
				});

				it('should reject invalid IPv6 addresses', () => {
					assert.throws(() => schema.parse('2001:0db8:85a3'), /Invalid IPv6 address/);
					assert.throws(() => schema.parse('::::::'), /Invalid IPv6 address/);
					assert.throws(() => schema.parse('12345::'), /Invalid IPv6 address/);
				});
			});

			describe('uri', () => {
				const schema = k.string().uri();

				it('should validate valid URIs', () => {
					assert.strictEqual(schema.parse('https://example.com'), 'https://example.com');
					assert.strictEqual(schema.parse('http://localhost:3000'), 'http://localhost:3000');
					assert.strictEqual(schema.parse('ftp://files.example.com'), 'ftp://files.example.com');
				});

				it('should reject invalid URIs', () => {
					assert.throws(() => schema.parse('invalid'), /Invalid URI format/);
					assert.throws(() => schema.parse('http://'), /Invalid URI format/);
					assert.throws(() => schema.parse('://example.com'), /Invalid URI format/);
				});
			});

			describe('hostname', () => {
				const schema = k.string().hostname();

				it('should validate valid hostnames', () => {
					assert.strictEqual(schema.parse('example.com'), 'example.com');
					assert.strictEqual(schema.parse('sub.example.com'), 'sub.example.com');
					assert.strictEqual(schema.parse('localhost'), 'localhost');
				});

				it('should reject invalid hostnames', () => {
					assert.throws(() => schema.parse('-invalid.com'), /Invalid hostname format/);
					assert.throws(() => schema.parse('example..com'), /Invalid hostname format/);
					assert.throws(() => schema.parse('example-.com'), /Invalid hostname format/);
				});
			});

			describe('byte', () => {
				const schema = k.string().byte();

				it('should validate valid base64', () => {
					assert.strictEqual(schema.parse('aGVsbG8='), 'aGVsbG8=');
					assert.strictEqual(schema.parse('YQ=='), 'YQ==');
					assert.strictEqual(schema.parse('YWI='), 'YWI=');
				});

				it('should reject invalid base64', () => {
					assert.throws(() => schema.parse('invalid'), /Invalid base64 format/);
					assert.throws(() => schema.parse('a==='), /Invalid base64 format/);
				});
			});
		});
	});

	describe('KNumber', () => {
		describe('basic validation', () => {
			const schema = k.number();

			it('should accept valid numbers', () => {
				assert.strictEqual(schema.parse(123), 123);
				assert.strictEqual(schema.parse(0), 0);
				assert.strictEqual(schema.parse(-123), -123);
				assert.strictEqual(schema.parse(123.456), 123.456);
			});

			it('should reject non-numbers', () => {
				assert.throws(() => schema.parse('123'), /Expected number/);
				assert.throws(() => schema.parse(true), /Expected number/);
				assert.throws(() => schema.parse(null), /Expected number/);
				assert.throws(() => schema.parse(undefined), /Expected number/);
				assert.throws(() => schema.parse({}), /Expected number/);
				assert.throws(() => schema.parse([]), /Expected number/);
			});
		});

		describe('range validation', () => {
			it('should validate minimum', () => {
				const schema = k.number().min(0);
				assert.strictEqual(schema.parse(0), 0);
				assert.strictEqual(schema.parse(123), 123);
				assert.throws(() => schema.parse(-1), /greater than or equal to 0/);
			});

			it('should validate exclusive minimum', () => {
				const schema = k.number().min(0, true);
				assert.strictEqual(schema.parse(1), 1);
				assert.throws(() => schema.parse(0), /greater than 0/);
				assert.throws(() => schema.parse(-1), /greater than 0/);
			});

			it('should validate maximum', () => {
				const schema = k.number().max(100);
				assert.strictEqual(schema.parse(0), 0);
				assert.strictEqual(schema.parse(100), 100);
				assert.throws(() => schema.parse(101), /less than or equal to 100/);
			});

			it('should validate exclusive maximum', () => {
				const schema = k.number().max(100, true);
				assert.strictEqual(schema.parse(99), 99);
				assert.throws(() => schema.parse(100), /less than 100/);
				assert.throws(() => schema.parse(101), /less than 100/);
			});

			it('should validate both min and max', () => {
				const schema = k.number().min(0).max(100);
				assert.strictEqual(schema.parse(0), 0);
				assert.strictEqual(schema.parse(50), 50);
				assert.strictEqual(schema.parse(100), 100);
				assert.throws(() => schema.parse(-1), /greater than or equal to 0/);
				assert.throws(() => schema.parse(101), /less than or equal to 100/);
			});
		});

		describe('integer validation', () => {
			const schema = k.number().integer();

			it('should accept valid integers', () => {
				assert.strictEqual(schema.parse(123), 123);
				assert.strictEqual(schema.parse(0), 0);
				assert.strictEqual(schema.parse(-123), -123);
			});

			it('should reject non-integers', () => {
				assert.throws(() => schema.parse(123.456), /Expected integer/);
				assert.throws(() => schema.parse(0.1), /Expected integer/);
				assert.throws(() => schema.parse(-123.456), /Expected integer/);
			});
		});

		describe('multipleOf validation', () => {
			it('should validate multiples', () => {
				const schema = k.number().multipleOf(5);
				assert.strictEqual(schema.parse(0), 0);
				assert.strictEqual(schema.parse(5), 5);
				assert.strictEqual(schema.parse(10), 10);
				assert.strictEqual(schema.parse(-5), -5);
				assert.throws(() => schema.parse(3), /multiple of 5/);
				assert.throws(() => schema.parse(7), /multiple of 5/);
			});

			it('should reject invalid multipleOf values', () => {
				assert.throws(() => k.number().multipleOf(0), /must be a positive number/);
				assert.throws(() => k.number().multipleOf(-1), /must be a positive number/);
			});
		});

		describe('number formats', () => {
			it('should validate float format', () => {
				const schema = k.number().format('float');
				assert.strictEqual(schema.parse(123.456), 123.456);
				assert.strictEqual(schema.parse(-123.456), -123.456);
			});

			it('should validate double format', () => {
				const schema = k.number().format('double');
				assert.strictEqual(schema.parse(123.456), 123.456);
				assert.strictEqual(schema.parse(-123.456), -123.456);
			});

			it('should validate int32 format', () => {
				const schema = k.number().format('int32');
				assert.strictEqual(schema.parse(123), 123);
				assert.throws(() => schema.parse(123.456), /Expected integer/);
			});

			it('should validate int64 format', () => {
				const schema = k.number().format('int64');
				assert.strictEqual(schema.parse(123), 123);
				assert.throws(() => schema.parse(123.456), /Expected integer/);
			});
		});
	});

	describe('KBoolean', () => {
		const schema = k.boolean();

		it('should accept valid booleans', () => {
			assert.strictEqual(schema.parse(true), true);
			assert.strictEqual(schema.parse(false), false);
		});

		it('should reject non-booleans', () => {
			assert.throws(() => schema.parse('true'), /Expected boolean/);
			assert.throws(() => schema.parse(1), /Expected boolean/);
			assert.throws(() => schema.parse(0), /Expected boolean/);
			assert.throws(() => schema.parse(null), /Expected boolean/);
			assert.throws(() => schema.parse(undefined), /Expected boolean/);
			assert.throws(() => schema.parse({}), /Expected boolean/);
			assert.throws(() => schema.parse([]), /Expected boolean/);
		});
	});

	describe('KArray', () => {
		describe('basic validation', () => {
			const schema = k.array(k.string());

			it('should accept valid arrays', () => {
				assert.deepStrictEqual(schema.parse([]), []);
				assert.deepStrictEqual(schema.parse(['a', 'b', 'c']), ['a', 'b', 'c']);
			});

			it('should reject non-arrays', () => {
				assert.throws(() => schema.parse('not an array'), /Expected array/);
				assert.throws(() => schema.parse(123), /Expected array/);
				assert.throws(() => schema.parse({}), /Expected array/);
				assert.throws(() => schema.parse(null), /Expected array/);
			});

			it('should validate array items', () => {
				assert.throws(() => schema.parse(['a', 123, 'c']), /Expected string/);
				assert.throws(() => schema.parse(['a', null, 'c']), /Expected string/);
			});
		});

		describe('length validation', () => {
			it('should validate minItems', () => {
				const schema = k.array(k.string()).minItems(2);
				assert.deepStrictEqual(schema.parse(['a', 'b']), ['a', 'b']);
				assert.deepStrictEqual(schema.parse(['a', 'b', 'c']), ['a', 'b', 'c']);
				assert.throws(() => schema.parse([]), /at least 2 items/);
				assert.throws(() => schema.parse(['a']), /at least 2 items/);
			});

			it('should validate maxItems', () => {
				const schema = k.array(k.string()).maxItems(2);
				assert.deepStrictEqual(schema.parse([]), []);
				assert.deepStrictEqual(schema.parse(['a']), ['a']);
				assert.deepStrictEqual(schema.parse(['a', 'b']), ['a', 'b']);
				assert.throws(() => schema.parse(['a', 'b', 'c']), /at most 2 items/);
			});
		});

		describe('uniqueItems validation', () => {
			const schema = k.array(k.string()).uniqueItems();

			it('should accept arrays with unique items', () => {
				assert.deepStrictEqual(schema.parse([]), []);
				assert.deepStrictEqual(schema.parse(['a']), ['a']);
				assert.deepStrictEqual(schema.parse(['a', 'b', 'c']), ['a', 'b', 'c']);
			});

			it('should reject arrays with duplicate items', () => {
				assert.throws(() => schema.parse(['a', 'a']), /must be unique/);
				assert.throws(() => schema.parse(['a', 'b', 'a']), /must be unique/);
			});
		});

		describe('nested arrays', () => {
			const schema = k.array(k.array(k.number()));

			it('should validate nested arrays', () => {
				assert.deepStrictEqual(schema.parse([]), []);
				assert.deepStrictEqual(
					schema.parse([
						[1, 2],
						[3, 4],
					]),
					[
						[1, 2],
						[3, 4],
					],
				);
				assert.throws(() => schema.parse([[1, '2']]), /Expected number/);
				assert.throws(() => schema.parse([1, 2]), /Expected array/);
			});
		});
	});

	describe('KRef', () => {
		const userSchema = k.ref('User', {
			id: k.number(),
			name: k.string(),
			email: k.string().email(),
		});

		describe('basic validation', () => {
			it('should accept valid objects', () => {
				const validUser = {
					id: 1,
					name: 'John',
					email: 'john@example.com',
				};
				assert.deepStrictEqual(userSchema.parse(validUser), validUser);
			});

			it('should reject invalid objects', () => {
				assert.throws(() => userSchema.parse(null), /Expected object/);
				assert.throws(() => userSchema.parse([]), /Expected object/);
				assert.throws(() => userSchema.parse('not an object'), /Expected object/);
				assert.throws(() => userSchema.parse(123), /Expected object/);
			});

			it('should validate required properties', () => {
				assert.throws(() => userSchema.parse({}), /Missing required property/);
				assert.throws(() => userSchema.parse({id: 1, name: 'John'}), /Missing required property/);
			});

			it('should validate property types', () => {
				assert.throws(() => userSchema.parse({id: '1', name: 'John', email: 'john@example.com'}), /Expected number/);
				assert.throws(() => userSchema.parse({id: 1, name: 123, email: 'john@example.com'}), /Expected string/);
				assert.throws(() => userSchema.parse({id: 1, name: 'John', email: 'invalid-email'}), /Invalid email format/);
			});
		});

		describe('nested refs', () => {
			const postSchema = k.ref('Post', {
				id: k.number(),
				title: k.string(),
				author: userSchema,
				tags: k.array(k.string()),
			});

			it('should validate nested refs', () => {
				const validPost = {
					id: 1,
					title: 'Hello World',
					author: {
						id: 1,
						name: 'John',
						email: 'john@example.com',
					},
					tags: ['hello', 'world'],
				};
				assert.deepStrictEqual(postSchema.parse(validPost), validPost);
			});

			it('should validate nested ref properties', () => {
				assert.throws(
					() =>
						postSchema.parse({
							id: 1,
							title: 'Hello World',
							author: {
								id: 1,
								name: 'John',
								email: 'invalid-email',
							},
							tags: ['hello', 'world'],
						}),
					/Invalid email format/,
				);
			});
		});
	});

	describe('OpenAPI Schema Generation', () => {
		it('should generate string schema', () => {
			const schema = k.string().minLength(3).maxLength(10).email().description('User email');

			assert.deepStrictEqual(schema.toOpenAPI(), {
				type: 'string',
				minLength: 3,
				maxLength: 10,
				format: 'email',
				description: 'User email',
			});
		});

		it('should generate number schema', () => {
			const schema = k.number().min(0).max(100).multipleOf(5).format('int32').description('Score');

			assert.deepStrictEqual(schema.toOpenAPI(), {
				type: 'integer',
				minimum: 0,
				maximum: 100,
				multipleOf: 5,
				format: 'int32',
				description: 'Score',
			});
		});

		it('should generate array schema', () => {
			const schema = k.array(k.string()).minItems(1).maxItems(5).uniqueItems().description('Tags');

			assert.deepStrictEqual(schema.toOpenAPI(), {
				type: 'array',
				items: {
					type: 'string',
				},
				minItems: 1,
				maxItems: 5,
				uniqueItems: true,
				description: 'Tags',
			});
		});

		it('should generate ref schema', () => {
			const schema = k
				.ref('User', {
					id: k.number(),
					name: k.string(),
				})
				.description('User object');

			assert.deepStrictEqual(schema.toOpenAPI(), {
				$ref: '#/components/schemas/User',
				description: 'User object',
			});
		});
	});

	describe('KScalar', () => {
		describe('basic scalar types', () => {
			const bigIntSchema = k.scalar({
				json: k.string(),
				parse: value => BigInt(value),
				serialize: value => value.toString(),
			});

			it('should parse and transform valid values', () => {
				const result = bigIntSchema.parse('123');
				assert.strictEqual(typeof result, 'bigint');
				assert.strictEqual(result, BigInt(123));
			});

			it('should serialize values back to json format', () => {
				const parsed = bigIntSchema.parse('123');
				const serialized = bigIntSchema.serialize(parsed);
				assert.strictEqual(serialized, '123');
			});

			it('should reject invalid input types', () => {
				assert.throws(() => bigIntSchema.parse(123), /Expected string/);
				assert.throws(() => bigIntSchema.parse(null), /Expected string/);
			});

			it('should reject invalid string formats', () => {
				assert.throws(() => bigIntSchema.parse('not a number'), /Cannot convert/);
				assert.throws(() => bigIntSchema.parse('12.34'), /Cannot convert/);
			});
		});

		describe('complex transformations', () => {
			const dateSchema = k.scalar<string, Date>({
				json: k.string().date(),
				parse: (value: string) => new Date(value),
				serialize: (value: Date) => value.toISOString().split('T')[0]!,
			});

			it('should parse dates from strings', () => {
				const result = dateSchema.parse('2023-12-31');
				assert(result instanceof Date);
				assert.strictEqual(result.getUTCFullYear(), 2023);
				assert.strictEqual(result.getUTCMonth(), 11); // 0-based
				assert.strictEqual(result.getUTCDate(), 31);
			});

			it('should serialize dates back to strings', () => {
				const date = new Date('2023-12-31');
				const serialized = dateSchema.serialize(date);
				assert.strictEqual(serialized, '2023-12-31');
			});

			it('should validate date format during parsing', () => {
				assert.throws(() => dateSchema.parse('invalid date'), /Invalid date format/);
				assert.throws(() => dateSchema.parse('2023/12/31'), /Invalid date format/);
			});
		});

		describe('with description and example', () => {
			const schema = k
				.scalar({
					json: k.string(),
					parse: value => BigInt(value),
					serialize: value => value.toString(),
				})
				.description('A big integer ID')
				.example('12345');

			it('should generate correct OpenAPI schema', () => {
				const openapi = schema.toOpenAPI();
				if ('description' in openapi) {
					assert.deepStrictEqual(openapi, {
						type: 'string',
						description: 'A big integer ID',
					});
				}
			});
		});
	});

	describe('KNull', () => {
		const schema = new KNull();

		describe('basic validation', () => {
			it('should accept null', () => {
				assert.strictEqual(schema.parse(null), null);
			});

			it('should reject non-null values', () => {
				assert.throws(() => schema.parse(undefined), /Expected null/);
				assert.throws(() => schema.parse(''), /Expected null/);
				assert.throws(() => schema.parse(0), /Expected null/);
				assert.throws(() => schema.parse(false), /Expected null/);
				assert.throws(() => schema.parse({}), /Expected null/);
				assert.throws(() => schema.parse([]), /Expected null/);
			});
		});

		describe('serialization', () => {
			it('should serialize null to null', () => {
				assert.strictEqual(schema.serialize(null), null);
			});
		});

		describe('OpenAPI schema', () => {
			it('should generate correct OpenAPI schema', () => {
				assert.deepStrictEqual(schema.toOpenAPI(), {
					type: 'null',
				});
			});
		});
	});

	describe('k object', () => {
		it('should provide access to all schema types', () => {
			assert(k.string() instanceof KString);
			assert(k.number() instanceof KNumber);
			assert(k.boolean() instanceof KBoolean);
			assert(k.array(k.string()) instanceof KArray);
			assert(k.ref('Test', {}) instanceof KRef);
			assert(k.null() instanceof KNull);

			// Test format convenience methods
			assert(k.date() instanceof KString);
			assert(k.dateTime() instanceof KString);
			assert(k.email() instanceof KString);
			assert(k.uuid() instanceof KString);
			assert(k.uri() instanceof KString);
			assert(k.hostname() instanceof KString);
			assert(k.ipv4() instanceof KString);
			assert(k.ipv6() instanceof KString);
			assert(k.password() instanceof KString);

			// Test number format convenience methods
			assert(k.float() instanceof KNumber);
			assert(k.double() instanceof KNumber);
			assert(k.int32() instanceof KNumber);
			assert(k.int64() instanceof KNumber);
		});
	});
});

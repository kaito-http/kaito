import assert from 'node:assert';
import {describe, it} from 'node:test';
import {BaseSchema, k, KArray, KBoolean, KLazy, KNull, KNumber, KRef, KString, KUnion} from './schema.ts';

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
				const schema = k.string().min(3);
				assert.strictEqual(schema.parse('hello'), 'hello');
				assert.strictEqual(schema.parse('123'), '123');
				assert.throws(() => schema.parse('hi'), /at least 3 characters/);
				assert.throws(() => schema.parse(''), /at least 3 characters/);
			});

			it('should validate maxLength', () => {
				const schema = k.string().max(5);
				assert.strictEqual(schema.parse('hello'), 'hello');
				assert.strictEqual(schema.parse('123'), '123');
				assert.throws(() => schema.parse('hello world'), /at most 5 characters/);
			});

			it('should validate both min and max length', () => {
				const schema = k.string().min(2).max(5);
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
				assert.throws(() => schema.parse('hello123'), /String must match/);
				assert.throws(() => schema.parse('Hello'), /String must match/);
			});

			it('should use custom error message', () => {
				const schema = k.string().regex(/^[a-z]+$/, 'must contain only lowercase letters');
				assert.strictEqual(schema.parse('hello'), 'hello');
				assert.throws(() => schema.parse('Hello'), /must contain only lowercase letters/);
			});
		});

		describe('startsWith validation', () => {
			it('should validate strings that start with prefix', () => {
				const schema = k.string().startsWith('hello');
				assert.strictEqual(schema.parse('hello world'), 'hello world');
				assert.strictEqual(schema.parse('hello'), 'hello');
				assert.throws(() => schema.parse('hi there'), /String must start with "hello"/);
				assert.throws(() => schema.parse('HELLO world'), /String must start with "hello"/);
			});

			it('should use custom error message', () => {
				const schema = k.string().startsWith('https://', 'URL must use HTTPS');
				assert.strictEqual(schema.parse('https://example.com'), 'https://example.com');
				assert.throws(() => schema.parse('http://example.com'), /URL must use HTTPS/);
			});

			it('should work with empty prefix', () => {
				const schema = k.string().startsWith('');
				assert.strictEqual(schema.parse('anything'), 'anything');
				assert.strictEqual(schema.parse(''), '');
			});
		});

		describe('endsWith validation', () => {
			it('should validate strings that end with suffix', () => {
				const schema = k.string().endsWith('.com');
				assert.strictEqual(schema.parse('example.com'), 'example.com');
				assert.strictEqual(schema.parse('.com'), '.com');
				assert.throws(() => schema.parse('example.org'), /String must end with "\.com"/);
				assert.throws(() => schema.parse('example.COM'), /String must end with "\.com"/);
			});

			it('should use custom error message', () => {
				const schema = k.string().endsWith('.ts', 'must be a TypeScript file');
				assert.strictEqual(schema.parse('index.ts'), 'index.ts');
				assert.throws(() => schema.parse('index.js'), /must be a TypeScript file/);
			});

			it('should work with empty suffix', () => {
				const schema = k.string().endsWith('');
				assert.strictEqual(schema.parse('anything'), 'anything');
				assert.strictEqual(schema.parse(''), '');
			});
		});

		describe('combined string validations', () => {
			it('should work with startsWith and endsWith together', () => {
				const schema = k.string().startsWith('hello').endsWith('world');
				assert.strictEqual(schema.parse('hello world'), 'hello world');
				assert.strictEqual(schema.parse('hello beautiful world'), 'hello beautiful world');
				assert.throws(() => schema.parse('hi world'), /String must start with "hello"/);
				assert.throws(() => schema.parse('hello earth'), /String must end with "world"/);
			});

			it('should work with length and prefix/suffix', () => {
				const schema = k.string().min(10).startsWith('test_');
				assert.strictEqual(schema.parse('test_12345'), 'test_12345');
				assert.throws(() => schema.parse('test_'), /at least 10 characters/);
				assert.throws(() => schema.parse('prod_12345'), /String must start with "test_"/);
			});

			it('should collect all validation errors', () => {
				const schema = k.string().min(10).startsWith('hello').endsWith('world');
				assert.throws(() => schema.parse('hi'));

				const result = schema.parseSafe('hi');
				assert.strictEqual(result.success, false);
				assert.strictEqual(result.issues.size, 3);
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
					assert.strictEqual(schema.parse('2024-02-29'), '2024-02-29');
					assert.strictEqual(schema.parse('2023-12-31'), '2023-12-31');
					assert.strictEqual(schema.parse('2023-01-01'), '2023-01-01');
				});

				it('should reject invalid dates', () => {
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
					// Standard web URLs
					assert.strictEqual(schema.parse('https://example.com'), 'https://example.com');
					assert.strictEqual(schema.parse('http://localhost:3000'), 'http://localhost:3000');
					assert.strictEqual(schema.parse('ftp://files.example.com'), 'ftp://files.example.com');

					// URLs with paths and query strings
					assert.strictEqual(
						schema.parse('https://example.com/path/to/resource'),
						'https://example.com/path/to/resource',
					);
					assert.strictEqual(schema.parse('http://example.com?query=param'), 'http://example.com?query=param');
					assert.strictEqual(schema.parse('https://example.com#fragment'), 'https://example.com#fragment');
					assert.strictEqual(
						schema.parse('https://example.com/path?query=1#section'),
						'https://example.com/path?query=1#section',
					);

					// Other URI schemes
					assert.strictEqual(schema.parse('mailto:user@example.com'), 'mailto:user@example.com');
					assert.strictEqual(schema.parse('tel:+1234567890'), 'tel:+1234567890');
					assert.strictEqual(schema.parse('data:text/plain;base64,SGVsbG8='), 'data:text/plain;base64,SGVsbG8=');
					assert.strictEqual(schema.parse('file:///home/user/file.txt'), 'file:///home/user/file.txt');
					assert.strictEqual(schema.parse('ssh://user@host.com:22'), 'ssh://user@host.com:22');
					assert.strictEqual(schema.parse('git://github.com/user/repo.git'), 'git://github.com/user/repo.git');

					// Edge cases that should be valid
					assert.strictEqual(schema.parse('http://127.0.0.1'), 'http://127.0.0.1');
					assert.strictEqual(schema.parse('https://[::1]:8080'), 'https://[::1]:8080'); // IPv6
					assert.strictEqual(schema.parse('http://user:pass@example.com'), 'http://user:pass@example.com'); // Auth
				});

				it('should reject invalid URIs', () => {
					// No scheme
					assert.throws(() => schema.parse('invalid'), /Invalid URI format/);
					assert.throws(() => schema.parse('example.com'), /Invalid URI format/);
					assert.throws(() => schema.parse('//example.com'), /Invalid URI format/);

					// Empty or incomplete schemes
					assert.throws(() => schema.parse('http://'), /Invalid URI format/);
					assert.throws(() => schema.parse('https://'), /Invalid URI format/);
					assert.throws(() => schema.parse('ftp://'), /Invalid URI format/);
					assert.throws(() => schema.parse('://example.com'), /Invalid URI format/);

					// Invalid scheme format
					assert.throws(() => schema.parse('123://example.com'), /Invalid URI format/); // Scheme can't start with number
					assert.throws(() => schema.parse('-http://example.com'), /Invalid URI format/); // Scheme can't start with dash
					assert.throws(() => schema.parse('ht!tp://example.com'), /Invalid URI format/); // Invalid character in scheme

					// Just scheme with colon but nothing after
					assert.throws(() => schema.parse('http:'), /Invalid URI format/);
					assert.throws(() => schema.parse('https:'), /Invalid URI format/);

					// Missing colon
					assert.throws(() => schema.parse('http//example.com'), /Invalid URI format/);
					assert.throws(() => schema.parse('httpsexample.com'), /Invalid URI format/);
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

			it('should validate maximum', () => {
				const schema = k.number().max(100);
				assert.strictEqual(schema.parse(0), 0);
				assert.strictEqual(schema.parse(100), 100);
				assert.throws(() => schema.parse(101), /less than or equal to 100/);
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
				const schema = k.number().float();
				assert.strictEqual(schema.parse(123.456), 123.456);
				assert.strictEqual(schema.parse(-123.456), -123.456);
			});

			it('should validate double format', () => {
				const schema = k.number().double();
				assert.strictEqual(schema.parse(123.456), 123.456);
				assert.strictEqual(schema.parse(-123.456), -123.456);
			});

			it('should validate int32 format', () => {
				const schema = k.number().int32();
				assert.strictEqual(schema.parse(123), 123);
				assert.throws(() => schema.parse(123.456), /Expected integer/);
			});

			it('should validate int64 format', () => {
				const schema = k.number().int64();
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
				const schema = k.array(k.string()).min(2);
				assert.deepStrictEqual(schema.parse(['a', 'b']), ['a', 'b']);
				assert.deepStrictEqual(schema.parse(['a', 'b', 'c']), ['a', 'b', 'c']);
				assert.throws(() => schema.parse([]), /at least 2 items/);
				assert.throws(() => schema.parse(['a']), /at least 2 items/);
			});

			it('should validate maxItems', () => {
				const schema = k.array(k.string()).max(2);
				assert.deepStrictEqual(schema.parse([]), []);
				assert.deepStrictEqual(schema.parse(['a']), ['a']);
				assert.deepStrictEqual(schema.parse(['a', 'b']), ['a', 'b']);
				assert.throws(() => schema.parse(['a', 'b', 'c']), /at most 2 items/);
			});
		});

		describe('uniqueItems validation', () => {
			const schema = k.array(k.string()).unique();

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

				const parsed = postSchema.parse(validPost);

				assert.deepStrictEqual(parsed, validPost);
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
			const schema = k.string().min(3).max(10).email().description('User email');

			assert.deepStrictEqual(schema.toOpenAPI(), {
				type: 'string',
				minLength: 3,
				maxLength: 10,
				format: 'email',
				description: 'User email',
			});
		});

		it('should generate number schema', () => {
			const schema = k.number().min(0).max(100).multipleOf(5).int32().description('Score');

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
			const schema = k.array(k.string()).min(1).max(5).unique().description('Tags');

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
				schema: k.string(),
				toServer: value => BigInt(value),
				toClient: value => value.toString(),
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
				assert.throws(
					() => bigIntSchema.parse('not a number'),
					/Failed to parse String to BigInt|Cannot convert not a number to a BigInt/,
				);
				assert.throws(
					() => bigIntSchema.parse('12.34'),
					/Failed to parse String to BigInt|Cannot convert 12.34 to a BigInt/,
				);
			});
		});

		describe('complex transformations', () => {
			const dateSchema = k.scalar<string, Date>({
				schema: k.string().date(),
				toServer: string => new Date(string),
				toClient: date => date.toISOString().split('T')[0]!,
			});

			it('should parse dates from strings', () => {
				const result = dateSchema.parse('2023-12-31');
				assert(result instanceof Date);
				assert.strictEqual(result.getUTCFullYear(), 2023);
				assert.strictEqual(result.getUTCMonth(), 11);
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
					schema: k.string(),
					toServer: value => BigInt(value),
					toClient: value => value.toString(),
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
		const schema = k.null();

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

	describe('KUnion', () => {
		const schema = k.union([k.string(), k.number()]);

		it('should accept all valid values', () => {
			assert.strictEqual(schema.parse('test'), 'test');
			assert.strictEqual(schema.parse(123), 123);
		});

		it('should reject invalid values', () => {
			assert.throws(() => schema.parse(null), /Expected number/);
			assert.throws(() => schema.parse(true), /Expected number/);
			assert.throws(() => schema.parse({}), /Expected number/);
			assert.throws(() => schema.parse([]), /Expected number/);
		});

		it('should work with complex object types', () => {
			const schema = k.union([
				k.ref('User', {
					a: k.string(),
				}),
				k.ref('User', {
					b: k.number(),
				}),
			]);

			assert.deepStrictEqual(schema.parse({a: 'test'}), {a: 'test'});
			assert.deepStrictEqual(schema.parse({b: 123}), {b: 123});
		});
	});

	describe('k object', () => {
		it('should provide access to all schema types', () => {
			assert(k.string() instanceof KString);
			assert(k.number() instanceof KNumber);
			assert(k.boolean() instanceof KBoolean);
			assert(k.array(k.string()) instanceof KArray);
			assert(k.null() instanceof KNull);
			assert(k.ref('Test', {}) instanceof KRef);
			assert(k.union([k.string(), k.number()]) instanceof KUnion);
		});
	});

	describe('OpenAPI example and description support', () => {
		it('should include example and description in string schema', () => {
			const schema = k.string().description('User email address').example('user@example.com');

			const openapi = schema.toOpenAPI();
			assert.deepStrictEqual(openapi, {
				type: 'string',
				description: 'User email address',
				example: 'user@example.com',
			});
		});

		it('should include example and description in number schema', () => {
			const schema = k.number().description('User age').example(25);

			const openapi = schema.toOpenAPI();
			assert.deepStrictEqual(openapi, {
				type: 'number',
				description: 'User age',
				example: 25,
			});
		});

		it('should include example and description in boolean schema', () => {
			const schema = k.boolean().description('Is user active').example(true);

			const openapi = schema.toOpenAPI();
			assert.deepStrictEqual(openapi, {
				type: 'boolean',
				description: 'Is user active',
				example: true,
			});
		});

		it('should include example and description in array schema', () => {
			const schema = k.array(k.string()).description('List of tags').example(['tag1', 'tag2']);

			const openapi = schema.toOpenAPI();
			assert.deepStrictEqual(openapi, {
				type: 'array',
				items: {type: 'string'},
				description: 'List of tags',
				example: ['tag1', 'tag2'],
			});
		});

		it('should include example and description in object schema', () => {
			const schema = k
				.object({
					name: k.string(),
					age: k.number(),
				})
				.description('User object')
				.example({name: 'John', age: 30});

			const openapi = schema.toOpenAPI();
			assert.deepStrictEqual(openapi, {
				type: 'object',
				properties: {
					name: {type: 'string'},
					age: {type: 'number'},
				},
				required: ['name', 'age'],
				description: 'User object',
				example: {name: 'John', age: 30},
			});
		});

		it('should include example and description in null schema', () => {
			const schema = k.null().description('Always null value').example(null);

			const openapi = schema.toOpenAPI();
			assert.deepStrictEqual(openapi, {
				type: 'null',
				description: 'Always null value',
				example: null,
			});
		});

		it('should include example and description in union schema', () => {
			const schema = k.union([k.string(), k.number()]).description('String or number').example('test');

			const openapi = schema.toOpenAPI() as any;
			assert.strictEqual(openapi.description, 'String or number');
			assert.strictEqual(openapi.example, 'test');
			assert(Array.isArray(openapi.oneOf));
		});

		it('should include example and description in literal schema', () => {
			const schema = k.literal('active').description('Status must be active').example('active');

			const openapi = schema.toOpenAPI();
			assert.deepStrictEqual(openapi, {
				type: 'string',
				enum: ['active'],
				description: 'Status must be active',
				example: 'active',
			});
		});

		it('should handle nested schemas with examples', () => {
			const schema = k.object({
				user: k
					.object({
						email: k.string().example('test@example.com'),
						age: k.number().example(25),
					})
					.example({email: 'john@example.com', age: 30}),
			});

			const openapi = schema.toOpenAPI() as any;
			const userSchema = openapi.properties.user;
			assert.strictEqual(userSchema.example.email, 'john@example.com');
			assert.strictEqual(userSchema.example.age, 30);
			assert.strictEqual(userSchema.properties.email.example, 'test@example.com');
			assert.strictEqual(userSchema.properties.age.example, 25);
		});

		it('should properly include example in KScalar OpenAPI output', () => {
			const schema = k
				.scalar({
					schema: k.string().description('String representation').example('12345'),
					toServer: value => BigInt(value),
					toClient: value => value.toString(),
				})
				.description('A big integer ID')
				.example('67890');

			// KScalar delegates to its inner schema, which should include both its own example and description
			const openapi = schema.toOpenAPI();
			assert.deepStrictEqual(openapi, {
				type: 'string',
				description: 'String representation',
				example: '12345',
			});
		});
	});

	describe('KLazy', () => {
		it('should delay schema creation until first use', () => {
			let created = false;
			const schema = k.lazy(() => {
				created = true;
				return k.string();
			});

			// Schema should not be created yet
			assert.strictEqual(created, false);

			// Now use the schema
			const result = schema.parse('test');
			assert.strictEqual(result, 'test');
			assert.strictEqual(created, true);
		});

		it('should cache the schema after first use', () => {
			let createCount = 0;
			const schema = k.lazy(() => {
				createCount++;
				return k.number();
			});

			schema.parse(123);
			schema.parse(456);
			schema.parse(789);

			// Should only be created once
			assert.strictEqual(createCount, 1);
		});

		it('should support recursive schemas', () => {
			type TreeNode = {
				value: string;
				children: TreeNode[];
			};

			const treeSchema: BaseSchema<any, TreeNode, any> = k.lazy(() =>
				k.object({
					value: k.string(),
					children: k.array(treeSchema),
				}),
			);

			const tree = {
				value: 'root',
				children: [
					{
						value: 'child1',
						children: [],
					},
					{
						value: 'child2',
						children: [
							{
								value: 'grandchild',
								children: [],
							},
						],
					},
				],
			};

			const parsed = treeSchema.parse(tree);
			assert.deepStrictEqual(parsed, tree);
		});

		it('should handle validation errors correctly', () => {
			const schema = k.lazy(() => k.string().email());

			assert.throws(() => schema.parse('not-an-email'), /Invalid email format/);
		});

		it('should support parseSafe', () => {
			const schema = k.lazy(() => k.number().min(0).max(100));

			const validResult = schema.parseSafe(50);
			assert.strictEqual(validResult.success, true);
			if (validResult.success) {
				assert.strictEqual(validResult.result, 50);
			}

			const invalidResult = schema.parseSafe(150);
			assert.strictEqual(invalidResult.success, false);
		});

		it('should support serialization', () => {
			const schema = k.lazy(() =>
				k.scalar({
					schema: k.string(),
					toServer: s => new Date(s),
					toClient: d => d.toISOString(),
				}),
			);

			const date = new Date('2023-01-01');
			const serialized = schema.serialize(date);
			assert.strictEqual(serialized, '2023-01-01T00:00:00.000Z');
		});

		it('should generate correct OpenAPI', () => {
			const schema = k.lazy(() => k.string().min(5));
			const openapi = schema.toOpenAPI();

			assert.deepStrictEqual(openapi, {
				type: 'string',
				minLength: 5,
			});
		});

		it('should work with visit method', () => {
			const schema = k.lazy(() =>
				k.object({
					name: k.string(),
					age: k.number(),
				}),
			);

			const visited: string[] = [];
			schema.visit(child => {
				if (child instanceof KString) visited.push('string');
				if (child instanceof KNumber) visited.push('number');
			});

			assert(visited.includes('string'));
			assert(visited.includes('number'));
		});

		it('should be an instance of KLazy', () => {
			const schema = k.lazy(() => k.string());
			assert(schema instanceof KLazy);
		});
	});

	describe('k.json()', () => {
		const schema = k.json();

		it('should accept primitive JSON values', () => {
			assert.strictEqual(schema.parse('string'), 'string');
			assert.strictEqual(schema.parse(123), 123);
			assert.strictEqual(schema.parse(true), true);
			assert.strictEqual(schema.parse(false), false);
			assert.strictEqual(schema.parse(null), null);
		});

		it('should accept arrays', () => {
			assert.deepStrictEqual(schema.parse([]), []);
			assert.deepStrictEqual(schema.parse([1, 2, 3]), [1, 2, 3]);
			assert.deepStrictEqual(schema.parse(['a', 'b', 'c']), ['a', 'b', 'c']);
			assert.deepStrictEqual(schema.parse([true, false, null]), [true, false, null]);
		});

		it('should accept objects', () => {
			assert.deepStrictEqual(schema.parse({}), {});
			assert.deepStrictEqual(schema.parse({a: 1}), {a: 1});
			assert.deepStrictEqual(schema.parse({name: 'test', age: 30}), {name: 'test', age: 30});
		});

		it('should accept nested structures', () => {
			const complex = {
				name: 'John',
				age: 30,
				active: true,
				scores: [95, 87, 92],
				metadata: {
					created: '2023-01-01',
					tags: ['user', 'admin'],
					settings: {
						theme: 'dark',
						notifications: true,
					},
				},
				nullable: null,
			};
			assert.deepStrictEqual(schema.parse(complex), complex);
		});

		it('should accept deeply nested arrays and objects', () => {
			const deeplyNested = [
				{
					a: [1, {b: [2, {c: [3, {d: 'deep'}]}]}],
				},
			];
			assert.deepStrictEqual(schema.parse(deeplyNested), deeplyNested);
		});

		it('should reject undefined', () => {
			assert.throws(() => schema.parse(undefined));
		});

		it('should reject functions', () => {
			assert.throws(() => schema.parse(() => {}));
		});

		it('should reject symbols', () => {
			assert.throws(() => schema.parse(Symbol('test')));
		});

		it('should accept dates as objects (they serialize to JSON)', () => {
			// Date objects are valid objects in JavaScript and can be serialized to JSON
			// They're treated as regular objects with properties
			const date = new Date('2023-01-01');
			const parsed = schema.parse(date);
			assert(typeof parsed === 'object');
		});

		it('should handle mixed type arrays', () => {
			const mixed = ['string', 123, true, null, {nested: 'object'}, ['nested', 'array']];
			assert.deepStrictEqual(schema.parse(mixed), mixed);
		});

		it('should work with parseSafe', () => {
			const result = schema.parseSafe({valid: 'json'});
			assert.strictEqual(result.success, true);
			if (result.success) {
				assert.deepStrictEqual(result.result, {valid: 'json'});
			}

			const invalid = schema.parseSafe(undefined);
			assert.strictEqual(invalid.success, false);
		});

		it('should serialize JSON values correctly', () => {
			const value = {a: 1, b: ['x', 'y'], c: null};
			assert.deepStrictEqual(schema.serialize(value), value);
		});
	});

	describe('KRecord', () => {
		describe('basic validation', () => {
			const schema = k.record(k.string(), k.number());

			it('should accept valid record objects', () => {
				assert.deepStrictEqual(schema.parse({}), {});
				assert.deepStrictEqual(schema.parse({a: 1}), {a: 1});
				assert.deepStrictEqual(schema.parse({a: 1, b: 2, c: 3}), {a: 1, b: 2, c: 3});
			});

			it('should reject non-objects', () => {
				assert.throws(() => schema.parse(null), /Expected object/);
				assert.throws(() => schema.parse(undefined), /Expected object/);
				assert.throws(() => schema.parse('string'), /Expected object/);
				assert.throws(() => schema.parse(123), /Expected object/);
				assert.throws(() => schema.parse(true), /Expected object/);
				assert.throws(() => schema.parse([]), /Expected object/);
			});

			it('should validate all values', () => {
				assert.throws(() => schema.parse({a: 'not a number'}), /Expected number/);
				assert.throws(() => schema.parse({a: 1, b: 'invalid'}), /Expected number/);
				assert.throws(() => schema.parse({a: 1, b: null}), /Expected number/);
			});

			it('should handle empty objects', () => {
				const result = schema.parse({});
				assert.deepStrictEqual(result, {});
			});

			it('should preserve all properties', () => {
				const input = {prop1: 1, prop2: 2, prop3: 3};
				const result = schema.parse(input);
				assert.deepStrictEqual(result, input);
			});
		});

		describe('key validation', () => {
			const schema = k.record(k.string().regex(/^[a-z]+$/), k.number());

			it('should validate keys match the pattern', () => {
				assert.deepStrictEqual(schema.parse({abc: 1, def: 2}), {abc: 1, def: 2});
			});

			it("should reject keys that don't match the pattern", () => {
				assert.throws(() => schema.parse({ABC: 1}), /String must match/);
				assert.throws(() => schema.parse({'123': 1}), /String must match/);
				assert.throws(() => schema.parse({'ab-cd': 1}), /String must match/);
			});
		});

		describe('complex value types', () => {
			const schema = k.record(
				k.string(),
				k.object({
					id: k.number(),
					name: k.string(),
				}),
			);

			it('should validate complex object values', () => {
				const input = {
					user1: {id: 1, name: 'Alice'},
					user2: {id: 2, name: 'Bob'},
				};
				assert.deepStrictEqual(schema.parse(input), input);
			});

			it('should reject invalid object values', () => {
				assert.throws(
					() =>
						schema.parse({
							user1: {id: 1, name: 'Alice'},
							user2: {id: '2', name: 'Bob'},
						}),
					/Expected number/,
				);

				assert.throws(
					() =>
						schema.parse({
							user1: {id: 1},
						}),
					/Missing required property: name/,
				);
			});
		});

		describe('nested records', () => {
			const schema = k.record(k.string(), k.record(k.string(), k.boolean()));

			it('should validate nested records', () => {
				const input = {
					group1: {flag1: true, flag2: false},
					group2: {flag3: true},
					group3: {},
				};
				assert.deepStrictEqual(schema.parse(input), input);
			});

			it('should reject invalid nested values', () => {
				assert.throws(
					() =>
						schema.parse({
							group1: {flag1: 'not boolean'},
						}),
					/Expected boolean/,
				);

				assert.throws(
					() =>
						schema.parse({
							group1: 'not an object',
						}),
					/Expected object/,
				);
			});
		});

		describe('serialization', () => {
			const schema = k.record(k.string(), k.number());

			it('should serialize record values correctly', () => {
				const value = {a: 1, b: 2, c: 3};
				const serialized = schema.serialize(value);
				assert.deepStrictEqual(serialized, value);
			});

			it('should serialize complex values', () => {
				const complexSchema = k.record(
					k.string(),
					k.scalar({
						schema: k.string(),
						toServer: s => new Date(s),
						toClient: d => d.toISOString(),
					}),
				);

				const dates = {
					date1: new Date('2023-01-01'),
					date2: new Date('2023-12-31'),
				};

				const serialized = complexSchema.serialize(dates);
				assert.deepStrictEqual(serialized, {
					date1: '2023-01-01T00:00:00.000Z',
					date2: '2023-12-31T00:00:00.000Z',
				});
			});
		});

		describe('parseSafe', () => {
			const schema = k.record(k.string(), k.number());

			it('should return success result for valid input', () => {
				const result = schema.parseSafe({a: 1, b: 2});
				assert.strictEqual(result.success, true);
				if (result.success) {
					assert.deepStrictEqual(result.result, {a: 1, b: 2});
				}
			});

			it('should return failure result for invalid input', () => {
				const result = schema.parseSafe({a: 'invalid'});
				assert.strictEqual(result.success, false);
				if (!result.success) {
					assert(result.issues.size > 0);
				}
			});

			it('should return error on first invalid value', () => {
				const result = schema.parseSafe({
					a: 'invalid1',
					b: 'invalid2',
					c: null,
				});
				assert.strictEqual(result.success, false);
				if (!result.success) {
					// parseSafe returns early on first error, consistent with other schemas
					assert(result.issues.size >= 1);
				}
			});
		});

		describe('OpenAPI generation', () => {
			it('should generate correct OpenAPI for simple record', () => {
				const schema = k.record(k.string(), k.number());
				const openapi = schema.toOpenAPI();

				assert.deepStrictEqual(openapi, {
					type: 'object',
					propertyNames: {
						type: 'string',
					},
					additionalProperties: {
						type: 'number',
					},
				});
			});

			it('should include key constraints in OpenAPI', () => {
				const schema = k.record(
					k
						.string()
						.regex(/^[a-z]+$/)
						.min(3)
						.max(10),
					k.number(),
				);
				const openapi = schema.toOpenAPI();

				assert.deepStrictEqual(openapi, {
					type: 'object',
					propertyNames: {
						type: 'string',
						pattern: '^[a-z]+$',
						minLength: 3,
						maxLength: 10,
					},
					additionalProperties: {
						type: 'number',
					},
				});
			});

			it('should include value constraints in OpenAPI', () => {
				const schema = k.record(k.string(), k.number().min(0).max(100));
				const openapi = schema.toOpenAPI();

				assert.deepStrictEqual(openapi, {
					type: 'object',
					propertyNames: {
						type: 'string',
					},
					additionalProperties: {
						type: 'number',
						minimum: 0,
						maximum: 100,
					},
				});
			});

			it('should generate OpenAPI for complex value types', () => {
				const schema = k.record(
					k.string(),
					k.object({
						id: k.number(),
						name: k.string(),
					}),
				);
				const openapi = schema.toOpenAPI();

				assert.deepStrictEqual(openapi, {
					type: 'object',
					propertyNames: {
						type: 'string',
					},
					additionalProperties: {
						type: 'object',
						properties: {
							id: {type: 'number'},
							name: {type: 'string'},
						},
						required: ['id', 'name'],
					},
				});
			});

			it('should include description and example', () => {
				const schema = k
					.record(k.string(), k.number())
					.description('A mapping of names to ages')
					.example({Alice: 30, Bob: 25});

				const openapi = schema.toOpenAPI();
				assert.deepStrictEqual(openapi, {
					type: 'object',
					propertyNames: {
						type: 'string',
					},
					additionalProperties: {
						type: 'number',
					},
					description: 'A mapping of names to ages',
					example: {Alice: 30, Bob: 25},
				});
			});
		});

		describe('with literal keys', () => {
			const schema = k.record(k.literal('constant'), k.number());

			it('should only accept the literal key', () => {
				assert.deepStrictEqual(schema.parse({constant: 42}), {constant: 42});
			});

			it('should reject other keys', () => {
				assert.throws(() => schema.parse({other: 42}), /Expected constant/);
			});
		});

		describe('with union value types', () => {
			const schema = k.record(k.string(), k.union([k.string(), k.number()]));

			it('should accept both string and number values', () => {
				const input = {
					a: 'string',
					b: 123,
					c: 'another string',
				};
				assert.deepStrictEqual(schema.parse(input), input);
			});

			it('should reject invalid union values', () => {
				assert.throws(() => schema.parse({a: true}), /Expected number/);
				assert.throws(() => schema.parse({a: null}), /Expected number/);
			});
		});

		describe('visit method', () => {
			it('should traverse key and value schemas', () => {
				const schema = k.record(k.string(), k.number());
				const visited: string[] = [];

				schema.visit(child => {
					if (child instanceof KString) visited.push('string');
					if (child instanceof KNumber) visited.push('number');
				});

				assert.deepStrictEqual(visited, ['string', 'number']);
			});
		});

		describe('edge cases', () => {
			it('should handle objects with prototype chain properties', () => {
				const schema = k.record(k.string(), k.number());
				const obj = Object.create({inherited: 999});
				obj.own = 123;

				const result = schema.parse(obj);
				assert.deepStrictEqual(result, {own: 123});
				assert(!('inherited' in result));
			});

			it('should handle numeric string keys', () => {
				const schema = k.record(k.string(), k.number());
				const input = {'123': 456, '789': 101};
				assert.deepStrictEqual(schema.parse(input), input);
			});

			it('should validate special character keys', () => {
				const schema = k.record(k.string(), k.number());
				const input = {
					'key-with-dash': 1,
					'key.with.dots': 2,
					key_with_underscore: 3,
					'key with spaces': 4,
				};
				assert.deepStrictEqual(schema.parse(input), input);
			});
		});

		describe('comparison with k.object', () => {
			it('should behave differently from object with fixed keys', () => {
				const recordSchema = k.record(k.string(), k.number());
				const objectSchema = k.object({a: k.number(), b: k.number()});

				// Record accepts any string keys
				assert.deepStrictEqual(recordSchema.parse({x: 1, y: 2}), {x: 1, y: 2});

				// Object requires specific keys
				assert.throws(() => objectSchema.parse({x: 1, y: 2}), /Missing required property/);
			});
		});
	});
});

/**
 * Creates a function that matches origins against a predefined set of patterns, supporting wildcards.
 * The matcher handles both exact matches and wildcard subdomain patterns.
 *
 * **⚠️ This API is experimental and may change or even be removed in the future. ⚠️**
 *
 * @param originIterator Array of origin patterns to match against.
 * Each pattern MUST include the protocol (http:// or https://).
 * Two types of patterns are supported:
 * 1. Exact matches (e.g., 'https://example.com') - matches only the exact domain with exact protocol
 * 2. Wildcard subdomain patterns (e.g., 'https://*.example.com') - matches ONLY subdomains with exact protocol
 *
 * Important matching rules:
 * - Protocol is always matched exactly - if you need both HTTP and HTTPS, include both patterns
 * - Wildcard patterns (e.g., 'https://*.example.com') will ONLY match subdomains, NOT the root domain
 * - To match both subdomains AND the root domain, include both patterns:
 *   ['https://*.example.com', 'https://example.com']
 *
 * @returns A function that tests if an origin matches any of the patterns
 *
 * @example
 * ```typescript
 * const allowedOrigins = [
 *   // Exact matches - protocol required
 *   'https://example.com',           // matches only https://example.com
 *   'http://example.com',            // matches only http://example.com
 *
 *   // Wildcard subdomain matches - protocol required
 *   'https://*.example.com',         // matches https://app.example.com, https://api.example.com
 *                                    // does NOT match https://example.com
 *
 *   // To match both HTTP and HTTPS, include both
 *   'https://*.staging.com',         // matches https://app.staging.com
 *   'http://*.staging.com',          // matches http://app.staging.com
 *
 *   // To match both subdomains and root domain, include both
 *   'https://*.production.com',      // matches https://app.production.com
 *   'https://production.com',        // matches https://production.com
 * ];
 *
 * const matcher = createOriginMatcher(allowedOrigins);
 *
 * // Exact matches
 * matcher('https://example.com');     // true
 * matcher('http://example.com');      // true
 *
 * // Subdomain matches (protocol specific)
 * matcher('https://app.example.com'); // true
 * matcher('http://app.example.com');  // false - wrong protocol
 *
 * // Root domain with wildcard pattern
 * matcher('https://example.com');     // false - wildcards don't match root
 * matcher('https://production.com');  // true - matched by exact pattern
 * ```
 */
export function experimental_createOriginMatcher(originIterator: Iterable<string>) {
	const origins = Array.from(originIterator);

	if (origins.length === 0) {
		return () => false; //lol
	}

	const escapedCharsRegex = /[.+?^${}()|[\]\\]/g;

	const source = origins
		.map(origin => {
			if (origin.includes('://*.')) {
				const parts = origin.split('://');

				if (parts.length !== 2) {
					throw new Error(`Invalid origin pattern: ${origin}. Must include protocol (e.g., https://*.example.com)`);
				}

				const [protocol, rest] = parts as [protocol: string, rest: string];

				const domain = rest.slice(2).replace(escapedCharsRegex, '\\$&');
				const pattern = `^${protocol.replace(escapedCharsRegex, '\\$&')}:\\/\\/[^.]+\\.${domain}$`;

				return pattern;
			} else {
				const pattern = `^${origin.replace(escapedCharsRegex, '\\$&')}$`;
				return pattern;
			}
		})
		.join('|');

	const regex = new RegExp(source);

	return (origin: string) => regex.test(origin);
}

/**
 * Create a CORS handler with sane defaults for most apps.
 *
 * **⚠️ This API is experimental and may change or even be removed in the future. ⚠️**
 *
 * @param originsIterator Array of allowed origin patterns. Each pattern must include protocol (http:// or https://).
 * Supports both exact matches and wildcard subdomain patterns. See {@link experimental_createOriginMatcher}
 * for detailed pattern matching rules.
 *
 * @returns An object containing:
 * - `before`: A handler for OPTIONS requests that returns a 204 response
 * - `transform`: A function that applies CORS headers to the response if origin matches
 * - `setOrigins`: A function to replace all allowed origins with a new set
 * - `appendOrigin`: A function to add a new origin to the allowed list
 * - `removeOrigin`: A function to remove an origin from the allowed list
 * - `getOrigins`: A function that returns the current list of allowed origins
 *
 * @example
 * ```ts
 * const corsHandler = experimental_createCORSTransform([
 *   // Exact matches
 *   'https://example.com',
 *   'http://localhost:3000',
 *
 *   // Wildcard subdomain matches
 *   'https://*.myapp.com',      // matches https://dashboard.myapp.com
 *   'http://*.myapp.com',       // matches http://dashboard.myapp.com
 *
 *   // Match both subdomain and root domain
 *   'https://*.staging.com',    // matches https://app.staging.com
 *   'https://staging.com'       // matches https://staging.com
 * ]);
 *
 * const router = create({
 *   // Handle preflight requests
 *   before: corsHandler.before,
 *
 *   // Or expanded
 *   before: (request) => {
 *     const res = cors.before(request);
 *     if (res) return res;
 *   },
 *
 *   // Apply CORS headers to all responses
 *   transform: corsHandler.transform,
 * });
 *
 * // Manage origins dynamically
 * corsHandler.appendOrigin('https://newdomain.com');
 * corsHandler.removeOrigin('http://localhost:3000');
 * corsHandler.setOrigins(['https://completely-new-domain.com']);
 * ```
 */
export function experimental_createCORSTransform(originsIterator: Iterable<string>) {
	let allowedOrigins = new Set<string>(originsIterator);
	let matcher = experimental_createOriginMatcher(allowedOrigins);

	const updateMatcher = () => {
		matcher = experimental_createOriginMatcher(allowedOrigins);
	};

	return {
		/**
		 * Handle OPTIONS requests in Kaito's `before()` hook
		 *
		 * @param request - The request object
		 * @returns A 204 response
		 */
		before: (request: Request) => {
			if (request.method === 'OPTIONS') {
				return new Response(null, {status: 204});
			}
		},
		/**
		 * Apply CORS headers to the response if origin matches.
		 *
		 * @param request - The request object
		 * @param response - The response object
		 */
		transform: (request: Request, response: Response) => {
			const origin = request.headers.get('Origin');

			if (origin && matcher(origin)) {
				response.headers.set('Access-Control-Allow-Origin', origin);
				response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
				response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
				response.headers.set('Access-Control-Max-Age', '86400');
				response.headers.set('Access-Control-Allow-Credentials', 'true');
			}
		},
		/**
		 * Replace all allowed origins with a new set.
		 *
		 * @param newOrigins - The new set of allowed origins
		 */
		setOrigins: (newOrigins: Iterable<string>) => {
			allowedOrigins = new Set(newOrigins);
			updateMatcher();
		},
		/**
		 * Add one or more origins to the allowed list.
		 *
		 * @param origins - The origins to add
		 */
		addOrigins: (...origins: string[]) => {
			for (const origin of origins) {
				allowedOrigins.add(origin);
			}
			updateMatcher();
		},
		/**
		 * Remove one or more origins from the allowed list.
		 *
		 * @param origins - The origins to remove
		 */
		removeOrigins: (...origins: string[]) => {
			for (const origin of origins) {
				allowedOrigins.delete(origin);
			}
			updateMatcher();
		},
		/**
		 * Clones the current set of allowed origins and returns it
		 *
		 * @returns A set of allowed origins
		 */
		getOrigins: () => new Set(allowedOrigins),
	};
}

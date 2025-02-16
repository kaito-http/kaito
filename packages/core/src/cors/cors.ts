/**
 * Creates a function that matches origins against a predefined set of patterns, supporting wildcards.
 * The matcher handles both exact matches and wildcard subdomain patterns.
 *
 * **⚠️ This API is experimental and may change or even be removed in the future. ⚠️**
 *
 * @param origins Array of origin patterns to match against.
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
export function experimental_createOriginMatcher(origins: string[]) {
	if (origins.length === 0) {
		return () => false; //lol
	}

	const source = origins
		.map(origin => {
			if (origin.includes('://*.')) {
				const escapedOrigin = origin.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
				const [protocol, domain] = escapedOrigin.split('\\://*\\.');
				return `^${protocol}\\:\\/\\/[^.]+\\.${domain}$`;
			} else {
				const escapedOrigin = origin.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
				return `^${escapedOrigin}$`;
			}
		})
		.join('|');

	const regex = new RegExp(source);

	return (origin: string) => regex.test(origin);
}

/**
 * Create a function to apply CORS headers with sane defaults for most apps.
 *
 * **⚠️ This API is experimental and may change or even be removed in the future. ⚠️**
 *
 * @param options Options object
 * @returns A function that will mutate the Response object by applying the CORS headers
 * @example
 * ```ts
 * const cors = experimental_createCORSTransform([
 *  	// Exact matches
 *  	'https://example.com',
 *  	'http://localhost:3000',
 *
 *  	// Wildcard subdomain matches
 *  	'https://*.myapp.com',      // matches https://dashboard.myapp.com
 *  	'http://*.myapp.com',       // matches http://dashboard.myapp.com
 *
 *  	// Match both subdomain and root domain
 *  	'https://*.staging.com',    // matches https://app.staging.com
 *  	'https://staging.com'       // matches https://staging.com
 *  ]);
 *
 * const router = create({
 * 		before: async req => {
 * 			if (req.method === 'OPTIONS') {
 * 				// Return early to skip the router. This response still gets passed to `.transform()`
 * 				// So our CORS headers will still be applied
 * 				return new Response(null, {status: 204});
 * 			}
 * 		},
 * 		transform: async (request, response) => {
 * 			cors(request, response);
 * 		}
 * });
 * ```
 */
export function experimental_createCORSTransform(origins: string[]) {
	const matcher = experimental_createOriginMatcher(origins);

	return (request: Request, response: Response) => {
		const origin = request.headers.get('Origin');

		if (origin && matcher(origin)) {
			response.headers.set('Access-Control-Allow-Origin', origin);
			response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
			response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
			response.headers.set('Access-Control-Max-Age', '86400');
			response.headers.set('Access-Control-Allow-Credentials', 'true');
		}
	};
}

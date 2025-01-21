/**
 * Creates a function that matches origins against a predefined set of patterns, supporting wildcards.
 * The matcher handles both exact matches and wildcard subdomain patterns (e.g., '*.example.com').
 *
 * @param origins Array of origin patterns to match against.
 * Patterns can be exact origins (e.g., 'https://example.com') or wildcard patterns (e.g., '*.example.com') that match subdomains.
 * @returns A function that tests if an origin matches any of the patterns
 *
 * @example
 * ```typescript
 * const allowedOrigins = [
 *   'https://example.com',
 *   '*.trusted-domain.com' // Won't match https://evil-domain.com, only subdomains
 * ];
 *
 * const matcher = createOriginMatcher(allowedOrigins);
 *
 * // Exact match
 * console.log(matcher('https://example.com')); // true
 * console.log(matcher('http://example.com')); // false
 *
 * // Wildcard subdomain matches
 * console.log(matcher('https://app.trusted-domain.com')); // true
 * console.log(matcher('https://staging.trusted-domain.com')); // true
 * console.log(matcher('https://trusted-domain.com')); // false, because it's not a subdomain
 * console.log(matcher('https://evil-domain.com')); // false
 * ```
 */
export function createOriginMatcher(origins: string[]) {
	if (origins.length === 0) {
		return () => false; //lol
	}

	const source = origins
		.map(origin => {
			if (origin.startsWith('*.')) {
				const escapedDomain = origin.slice(2).replace(/[.+?^${}()|[\]\\]/g, '\\$&');
				return `^(?:https?:\/\/)[^.]+\\.${escapedDomain}$`;
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
 * @param options Options object
 * @returns A function that will mutate the Response object by applying the CORS headers
 * @example
 * ```ts
 * const cors = createCORSHandler({
 *   origins: ['https://example.com', "*.allows-subdomains.com", "http://localhost:3000"],
 * });
 *
 * const handler = createKaitoHandler({
 *  // ...
 *  transform: async (request, response) => {
 *    cors(request, response);
 *  }
 * });
 * ```
 */
export function createCORSTransform(origins: string[]) {
	const matcher = createOriginMatcher(origins);

	return (request: Request, response: Response) => {
		const origin = request.headers.get('Origin');

		if (origin && matcher(origin)) {
			response.headers.set('Access-Control-Allow-Origin', origin);
			response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
			response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
			response.headers.set('Access-Control-Max-Age', '86400');
			response.headers.set('Access-Control-Allow-Credentials', 'true');
		}
	};
}

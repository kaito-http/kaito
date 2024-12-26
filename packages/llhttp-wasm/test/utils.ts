type HTTPVersion = '1.0' | '1.1' | '2.0';

interface RequestToHttpOptions {
	version?: HTTPVersion;
	includeHost?: boolean;
}

async function requestInitToHttp(
	input: RequestInfo | URL,
	init?: RequestInit,
	options: RequestToHttpOptions = {},
): Promise<string> {
	const {version = '1.1', includeHost = true} = options;
	const request = new Request(input, init);
	const method = request.method;
	const url = new URL(request.url);
	const headers = Array.from(request.headers.entries());

	// Build the request line
	let httpString = `${method} `;
	httpString += includeHost ? request.url : `${url.pathname}${url.search}${url.hash}`;
	httpString += ` HTTP/${version}\r\n`;

	// Add host header if not present and includeHost is true
	if (includeHost && !request.headers.has('host')) {
		headers.push(['Host', url.host]);
	}

	// Add content-length if body exists and not already set
	const bodyText = await getRequestBody(request.clone());
	if (bodyText && !request.headers.has('content-length')) {
		headers.push(['Content-Length', Buffer.from(bodyText).length.toString()]);
	}

	// Add headers
	httpString += headers.map(([key, value]) => `${key}: ${value}`).join('\r\n');

	// Add blank line between headers and body
	httpString += '\r\n\r\n';

	// Add body if it exists
	if (bodyText) {
		httpString += bodyText;
	}

	return httpString;
}

async function getRequestBody(request: Request): Promise<string | null> {
	if (!request.body) return null;

	const contentType = request.headers.get('content-type');
	const body = await request.clone().arrayBuffer();
	const decoder = new TextDecoder('utf-8');
	const bodyText = decoder.decode(body);

	// Handle different content types
	if (contentType?.includes('application/json')) {
		try {
			// Pretty print JSON if it's valid
			const json = JSON.parse(bodyText);
			return JSON.stringify(json, null, 2);
		} catch {
			// Return raw if invalid JSON
			return bodyText;
		}
	}

	// For form data, convert to application/x-www-form-urlencoded format
	if (contentType?.includes('application/x-www-form-urlencoded')) {
		try {
			const formData = new URLSearchParams(bodyText);
			return Array.from(formData.entries())
				.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
				.join('&');
		} catch {
			return bodyText;
		}
	}

	// For multipart/form-data, maintain boundary and format
	if (contentType?.includes('multipart/form-data')) {
		const boundary = contentType.split('boundary=')[1];
		if (boundary) {
			const parts = bodyText.split(`--${boundary}`);
			return `--${boundary}${parts.join(`--${boundary}`)}--\r\n`;
		}
	}

	return bodyText;
}

export {requestInitToHttp, type HTTPVersion, type RequestToHttpOptions};

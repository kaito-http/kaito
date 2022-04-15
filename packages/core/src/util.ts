import getRawBody from 'raw-body';
import {KaitoRequest} from './req';

export function getLastEntryInMultiHeaderValue(headerValue: string | string[]) {
	const normalized = Array.isArray(headerValue) ? headerValue.join(',') : headerValue;
	const lastIndex = normalized.lastIndexOf(',');

	return lastIndex === -1 ? normalized.trim() : normalized.slice(lastIndex + 1).trim();
}

// Type for import('http').METHODS
export type Method =
	| 'ACL'
	| 'BIND'
	| 'CHECKOUT'
	| 'CONNECT'
	| 'COPY'
	| 'DELETE'
	| 'GET'
	| 'HEAD'
	| 'LINK'
	| 'LOCK'
	| 'M-SEARCH'
	| 'MERGE'
	| 'MKACTIVITY'
	| 'MKCALENDAR'
	| 'MKCOL'
	| 'MOVE'
	| 'NOTIFY'
	| 'OPTIONS'
	| 'PATCH'
	| 'POST'
	| 'PRI'
	| 'PROPFIND'
	| 'PROPPATCH'
	| 'PURGE'
	| 'PUT'
	| 'REBIND'
	| 'REPORT'
	| 'SEARCH'
	| 'SOURCE'
	| 'SUBSCRIBE'
	| 'TRACE'
	| 'UNBIND'
	| 'UNLINK'
	| 'UNLOCK'
	| 'UNSUBSCRIBE';

export async function getInput(req: KaitoRequest) {
	if (req.method === 'GET') {
		const input = req.url.searchParams.get('input');

		if (!input) {
			return null;
		}

		return JSON.parse(input) as unknown;
	}

	const buffer = await getRawBody(req.raw);

	switch (req.headers['content-type']) {
		case 'application/json': {
			return JSON.parse(buffer.toString()) as unknown;
		}

		default: {
			return null;
		}
	}
}

import {createKaitoHandler} from '@kaito-http/core';
import {sse} from '@kaito-http/core/stream';
import {KaitoServer} from '@kaito-http/uws';
import {z} from 'zod';
import {config as dotenvConfig} from 'dotenv';
import {getContext, router} from './context.ts';
import {tellMeAStory, createGoogleAI} from './ai.ts';

// Load environment variables from .env file
dotenvConfig();

// Create a single instance of the google AI client
const googleAI = createGoogleAI();
const gemini = googleAI.getGenerativeModel({model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'});

const v1 = router()
	.get('/story', {
		run: async ({query}) => {
			console.error('story query', query);
			return sse(async function* () {
				console.error('getting story');
				const storyGenerator = await tellMeAStory(gemini, {
					topic: 'kaito, a typesafe Functional HTTP Framework for TypeScript',
				});
				console.error('got story');
				for await (const chunk of storyGenerator) {
					yield {
						data: chunk,
					};
				}
			});
		},
	})
	.get('/stories', {
		query: {
			topic: z.string(),
		},
		run: async ({query}) => {
			console.error('story query', query);
			return sse(async function* () {
				console.error('getting story');
				const storyGenerator = await tellMeAStory(gemini, {
					topic: query.topic || 'kaito, a typesafe Functional HTTP Framework for TypeScript',
				});
				console.error('got story');
				for await (const chunk of storyGenerator) {
					yield {
						data: chunk,
					};
				}
			});
		},
	});

const root = router().merge('/v1', v1);

const cors = (origin: string, response: Response) => {
	response.headers.set('Access-Control-Allow-Origin', origin);
	response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	response.headers.set('Access-Control-Max-Age', '86400');
	response.headers.set('Access-Control-Allow-Credentials', 'true');
	return response;
};

const ALLOWED_ORIGINS = ['http://localhost:3000', 'https://app.example.com'];

const handle = createKaitoHandler({
	router: root,
	getContext,

	onError: async ({error}) => ({
		status: 500,
		message: error.message,
	}),

	before: async req => {
		console.log('req', req, req.url);
		const origin = req.headers.get('origin');

		if (req.method === 'OPTIONS' && origin && ALLOWED_ORIGINS.includes(origin)) {
			return cors(origin, new Response(null, {status: 204}));
		}
	},
});

const server = await KaitoServer.serve({
	port: parseInt(process.env.PORT ?? '3000', 10),
	fetch: handle,
});

console.log('Server listening at', server.url);

export type App = typeof root;

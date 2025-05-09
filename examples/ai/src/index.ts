import {createKaitoHandler} from '@kaito-http/core';
import {sse} from '@kaito-http/core/stream';
import {KaitoServer} from '@kaito-http/uws';
import 'dotenv/config';
import {z} from 'zod';
import {createGoogleAI, tellMeAStory} from './ai.ts';
import {getContext, router} from './context.ts';

// Create a single instance of the google AI client
const googleAI = createGoogleAI();
const gemini = googleAI.getGenerativeModel({model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'});

const v1 = router()
	.get('/story', {
		run: async ({query}) => {
			console.error('story query', query);
			return sse(async function* () {
				console.error('getting story');
				const storyGenerator = tellMeAStory(gemini, {
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
				const storyGenerator = tellMeAStory(gemini, {
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

const handle = createKaitoHandler({
	router: root,
	getContext,

	onError: async ({error}) => ({
		status: 500,
		message: error.message,
	}),
});

const server = await KaitoServer.serve({
	port: 3000,
	fetch: handle,
});

console.log('Server listening at', server.url);

export type App = typeof root;

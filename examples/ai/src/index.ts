import 'dotenv/config';

import {k} from '@kaito-http/core';
import {sse} from '@kaito-http/core/stream';
import {Server} from '@kaito-http/uws';
import {createGoogleAI, tellMeAStory} from './ai.ts';
import {router} from './context.ts';

// Create a single instance of the google AI client
const googleAI = createGoogleAI();
const gemini = googleAI.getGenerativeModel({model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'});

const v1 = router
	.get('/story', {
		run: async () => {
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
			topic: k
				.string()
				.description('The topic of the story')
				.or(k.null().description('If no topic is provided, a default topic will be used')),
		},
		run: async ({query}) => {
			console.error('story query', query);

			const stream = sse(async function* () {
				console.error('getting story');
				const storyGenerator = tellMeAStory(gemini, {
					topic: query.topic ?? 'kaito, a typesafe Functional HTTP Framework for TypeScript',
				});

				for await (const chunk of storyGenerator) {
					yield {data: chunk};
				}
			});

			return stream;
		},
	});

const root = router.merge('/v1', v1);

const server = await Server.serve({
	port: 3000,
	fetch: root.serve(),
});

console.log('Server listening at', server.url);

export type App = typeof root;

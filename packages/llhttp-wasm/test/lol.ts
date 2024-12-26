Bun.serve({
	port: 3000,
	fetch: () => {},
	static: {
		'/': new Response('Nice', {status: 200}),
	},
});

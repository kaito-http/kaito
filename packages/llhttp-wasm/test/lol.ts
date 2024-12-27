Bun.serve({
	port: 3000,
	fetch: async req => {
		console.log(req.url);
		return new Response('Nice', {status: 200});
	},
});

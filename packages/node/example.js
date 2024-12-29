import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

const binding = require('./binding.node');

const server = binding.server(request => {
	console.log(request);
	return 'Hello World';
});

console.log(server);

import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

const addon = require('./http.node');

const server = addon.create();

server.listen(8080, () => {
	return 'HELLO group chat!';
});

console.log('Server listening on http://localhost:8080');

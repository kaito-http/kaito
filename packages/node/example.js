import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

const binding = require('./binding.node');

console.log('Starting server...');
binding.server(8080);
console.log(`Server started! Try visiting http://localhost:8080`);

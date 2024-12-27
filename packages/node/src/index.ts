import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

const addon = require('./http.node');

console.log(addon);

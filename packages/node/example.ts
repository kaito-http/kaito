import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

const binding = require('./binding.node');

console.log(binding.foo());

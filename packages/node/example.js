import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);

const binding = require('./binding.node');

// Spawn a process that will kill this one after 5s
const thisPid = process.pid;
spawn('node', ['-e', `setTimeout(() => { process.kill(${thisPid}, 'SIGKILL'); }, 10_000);`]);

// Redirect stderr to console
process.stderr.on('data', data => {
	console.error(data.toString());
});

console.log('Starting server...');
binding.server(8080);
console.log(`Server started! Try visiting http://localhost:8080`);

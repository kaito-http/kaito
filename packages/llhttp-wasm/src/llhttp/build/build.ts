import {execSync} from 'child_process';
import {readFileSync, writeFileSync} from 'fs';
import {resolve, join, dirname} from 'path';
import {fileURLToPath} from 'url';

async function buildLLHTTPWasm() {
	try {
		const scriptDir = dirname(fileURLToPath(import.meta.url));
		const dockerfilePath = resolve(scriptDir, './Build.dockerfile');
		const buildDir = resolve(scriptDir, './wasm');

		console.log('Building Docker image...');
		execSync(`docker build -t llhttp -f ${dockerfilePath} .`, {
			stdio: 'inherit',
			cwd: scriptDir,
		});

		console.log('Running Docker container to build WASM...');
		execSync(`docker run --rm -v "${buildDir}:/build/build/wasm" llhttp`, {
			stdio: 'inherit',
			cwd: scriptDir,
		});

		console.log('Converting WASM to base64...');
		const wasmPath = join(buildDir, 'llhttp.wasm');
		const wasmBuffer = readFileSync(wasmPath);
		const base64Wasm = wasmBuffer.toString('base64');

		const def = `// Generated by llhttp-wasm/src/llhttp/build/build.ts\nexport const wasmBase64 = "${base64Wasm}";`;
		writeFileSync(join(scriptDir, '../base64.ts'), def);

		console.log('Cleaning up...');
		const filesToRemove = ['constants.js.map', 'llhttp.wasm', 'utils.js.map'];

		for (const file of filesToRemove) {
			const filePath = join(buildDir, file);
			try {
				execSync(`rm -f "${filePath}"`);
			} catch (err) {
				console.warn(`Warning: Could not remove ${file}`);
			}
		}
		console.log('Build completed successfully!');
		console.log(`WASM file: ${wasmPath}`);
		console.log(`Base64 file: ${join(scriptDir, './llhttp.ts')}`);
	} catch (error) {
		console.error('Build failed:', error);
		process.exit(1);
	}
}

buildLLHTTPWasm().catch(console.error);

const {spawn} = require('child_process');
const net = require('net');
const path = require('path');

// Change to the examples/ai directory
process.chdir(path.dirname(__filename));

// Function to check if port is available
function waitForPort(port) {
	return new Promise(resolve => {
		const intervalId = setInterval(() => {
			const socket = new net.Socket();

			socket.on('connect', () => {
				socket.destroy();
				clearInterval(intervalId);
				resolve();
			});

			socket.on('error', () => {
				socket.destroy();
			});

			socket.connect(port, 'localhost');
		}, 100);
	});
}

let serverProcess = null;

async function main() {
	try {
		// Start server in background
		serverProcess = spawn('node', ['--import=tsx', './src/index.ts'], {
			stdio: ['ignore', 'inherit', 'inherit'],
			detached: false,
		});

		// Wait for server to be ready
		await waitForPort(3000);

		// Run CLI in foreground
		const cliProcess = spawn('node', ['--import=tsx', './src/client.ts'], {
			stdio: 'inherit',
		});

		// Wait for CLI to exit
		await new Promise((resolve, reject) => {
			cliProcess.on('exit', code => {
				if (code === 0) resolve();
				else reject(new Error(`CLI exited with code ${code}`));
			});
		});
	} finally {
		// Cleanup server process
		if (serverProcess) {
			serverProcess.kill();
		}
	}
}

// Handle process signals for cleanup
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
	process.on(signal, () => {
		if (serverProcess) {
			serverProcess.kill();
		}
		process.exit();
	});
});

main().catch(error => {
	console.error('Error:', error);
	if (serverProcess) {
		serverProcess.kill();
	}
	process.exit(1);
});

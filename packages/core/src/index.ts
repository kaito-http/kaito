export interface KaitoServer {
	//
}

export interface KaitoRequest {
	//
}

export const servers = {
	node: async () => {
		const http = await import('node:http');

		const server = await http.createServer();
	},
};

export interface KaitoOptions {
	//
}

export function kaito(options: KaitoOptions) {
	//
}

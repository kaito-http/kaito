export type ExampleSSETypes =
	| {
			event: 'numbers';
			data: {
				digits: number;
			};
	  }
	| {
			event: 'text';
			data: {
				text: string;
			};
	  }
	| {
			event: 'data';
			data: {
				obj: {
					str: string;
					num: number;
					nested: {
						bool: boolean;
					};
				};
			};
	  };

export function randomEvent(): ExampleSSETypes {
	// Randomly choose between the three event types
	const choice = Math.floor(Math.random() * 3);

	switch (choice) {
		case 0:
			return {
				event: 'numbers',
				data: {
					digits: Math.floor(Math.random() * 100),
				},
			};
		case 1:
			return {
				event: 'text',
				data: {
					text: 'lorem ipsum',
				},
			};
		default:
			return {
				event: 'data',
				data: {
					obj: {
						str: 'Example string',
						num: Math.random() * 100,
						nested: {
							bool: Math.random() > 0.5,
						},
					},
				},
			};
	}
}

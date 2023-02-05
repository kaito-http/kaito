export class KaitoHeaders implements Map<string, string | string[]> {
	private readonly map: Map<string, string | string[]>;

	constructor(entries?: [string, string | string[]][] | null) {
		this.map = new Map(entries?.map(entry => [entry[0].toLowerCase(), entry[1]]));
	}

	get size() {
		return this.map.size;
	}

	get [Symbol.toStringTag]() {
		return 'KaitoHeaders';
	}

	clear(): void {
		this.map.clear();
	}

	delete(key: string): boolean {
		return this.map.delete(key.toLowerCase());
	}

	forEach(
		callbackfn: (value: string | string[], key: string, map: Map<string, string | string[]>) => void,
		thisArg?: any
	): void {
		this.map.forEach(callbackfn, thisArg);
	}

	get(key: string): string | string[] | undefined {
		return this.map.get(key.toLowerCase());
	}

	has(key: string): boolean {
		return this.map.has(key.toLowerCase());
	}

	set(key: string, value: string | string[]): this {
		this.map.set(key.toLowerCase(), value);
		return this;
	}

	entries(): IterableIterator<[string, string | string[]]> {
		return this.map.entries();
	}

	keys(): IterableIterator<string> {
		return this.map.keys();
	}

	values(): IterableIterator<string | string[]> {
		return this.map.values();
	}

	[Symbol.iterator](): IterableIterator<[string, string | string[]]> {
		return this.map[Symbol.iterator]();
	}

	toObject() {
		return Object.fromEntries(this.map);
	}
}

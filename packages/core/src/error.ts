export class WrappedError<T> extends Error {
	static from<T>(maybeError: T) {
		if (maybeError instanceof Error) {
			return maybeError;
		}

		return new WrappedError(maybeError);
	}

	constructor(public readonly data: T) {
		super('Something was thrown, but it was not an instance of Error, so a WrappedError was created.');
	}
}

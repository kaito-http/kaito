export class WrappedError<T> extends Error {
	public static maybe<T>(maybeError: T) {
		if (maybeError instanceof Error) {
			return maybeError;
		}

		return WrappedError.from(maybeError);
	}

	public static from<T>(data: T) {
		return new WrappedError(data);
	}

	private constructor(public readonly data: T) {
		super('Something was thrown, but it was not an instance of Error, so a WrappedError was created.');
	}
}

export class KaitoError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
	}
}

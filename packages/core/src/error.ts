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

	public readonly data: T;

	private constructor(data: T) {
		super('Something was thrown, but it was not an instance of Error, so a WrappedError was created.');
		this.data = data;
	}
}

export class KaitoError extends Error {
	public readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export class HttpException extends Error {
  public readonly code: number;

  /**
   * Construct an HTTP Exception
   * @param code
   * @param message Can be multiple strings in an array, or a single message
   */
  constructor(code: number, message: string | string[]) {
    super(typeof message === "string" ? message : message.join(", "));
    this.code = code;
  }
}

export class NotFoundException extends HttpException {
  constructor() {
    super(404, "That resource was not found");
  }
}

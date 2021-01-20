export class HttpException extends Error {
  public readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export class UnknownUserException extends HttpException {
  constructor() {
    super(404, "User was not found");
  }
}

export class ValidationException extends HttpException {
  constructor() {
    super(422, "Invalid request body");
  }
}

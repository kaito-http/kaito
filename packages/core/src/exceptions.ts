export class HttpException extends Error {
  public readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export class ValidationException extends HttpException {
  constructor() {
    super(422, "Invalid request body");
  }
}

export class NotFoundException extends HttpException {
  constructor() {
    super(404, "That resource was not found");
  }
}

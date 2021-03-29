import { KaitoContext } from "../types";
import { HttpException } from "../exceptions";
import { ZodError } from "zod";

export function defaultErrorHandler(err: Error, ctx: KaitoContext) {
  ctx.res.setHeader("Content-Type", "application/json");

  if (err instanceof HttpException) {
    const body = JSON.stringify({
      message: err.message,
      code: err.code,
      error: "HttpException",
    });

    ctx.res.writeHead(err.code, {
      "Content-Type": "application/json",
    });

    ctx.res.end(body);
  } else if (err instanceof ZodError) {
    const body = JSON.stringify({
      message: err.errors.map((error) => error.message).join(", "),
      code: 422,
      error: "ZodError",
    });

    ctx.res.writeHead(422, {
      "Content-Type": "application/json",
    });

    ctx.res.end(body);
  } else {
    ctx.res.statusCode = 500;

    const body = JSON.stringify({
      message: "Something went wrong on our side",
      error: err.constructor.name,
      code: 500,
    });

    ctx.res.end(body);
  }
}

import { IncomingMessage } from "http";
import EventEmitter from "events";

export type ReqWithBody<T = unknown> = IncomingMessage & {
  body?: T;
} & EventEmitter;

type NextFunction = (err?: Error) => void;

export function parse<T = unknown>(fn: (body: { toString(): string }) => T) {
  return async (req: ReqWithBody<T>, _res: Response, next: (err?: Error) => void) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method as "POST")) {
      try {
        let body = "";

        for await (const chunk of req) body += chunk;

        req.body = fn(body);
      } catch (e) {
        next(e);
      }
    }

    next();
  };
}

export const json = () => (req: ReqWithBody, _res: Response, next: NextFunction) => {
  return parse((x) => JSON.parse(x.toString()))(req, _res, next);
};

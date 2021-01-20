/* eslint-disable @typescript-eslint/ban-types */
import "reflect-metadata";
import {
  KaitoRequest,
  KaitoResponse,
  MetadataKeys,
  Method,
  RequestHandler,
  SchemaFunction,
  ServerConstructorOptions,
} from "./types";
import { createHttpTerminator } from "http-terminator";
import Trouter, { HTTPMethod } from "trouter";
import http, { IncomingMessage, ServerResponse } from "http";

import { lead, parse } from "./utils/url";
import querystring from "querystring";
import { HttpException, ValidationException } from "./exceptions";

export class Kaito extends Trouter<RequestHandler> {
  readonly kaitoOptions;
  readonly server = http.createServer();
  readonly terminate = createHttpTerminator({
    server: this.server,
  });

  constructor(options: ServerConstructorOptions) {
    super();
    this.addControllers(options.controllers);
    this.requestHandler = this.requestHandler.bind(this);
    this.kaitoOptions = options;
  }

  static waitForStream(request: IncomingMessage) {
    let body: string;

    return new Promise((resolve) => {
      request.on("data", (chunk: Buffer) => (body += chunk.toString()));
      request.on("end", () => resolve(body));
    });
  }

  private async requestHandler(request: IncomingMessage, response: ServerResponse) {
    const { handlers, params } = this.find((request.method as HTTPMethod) || "GET", request.url || "/");

    if (!request.url) return;

    const parsed = parse(request.url);

    const req: KaitoRequest = {
      body: await Kaito.waitForStream(request),
      params,
      pathname: "",
      query: querystring.parse(request.url),
      raw: request,
      url: parsed,
    };

    const res: KaitoResponse = {
      json(json: unknown): void {
        response.setHeader("Content-Type", "application/json");
        response.write(JSON.stringify(json));
        response.end();
      },
      text(body: string) {
        response.setHeader("Content-Type", "text/plain");
        response.write(body);
        response.end();
      },
      status(code: number) {
        response.statusCode = code;
        return res;
      },
      write: response.write,
      end: response.end,
      raw: response,
    };

    for (const handler of handlers) {
      const result = handler(req, res);

      if (result instanceof Promise) {
        res.json(await result);
      }
    }
  }

  /**
   * Listen on the specified port. If no port is specified, it will try to use the environment variable PORT
   * @param port
   */
  listen(port?: string | number) {
    this.server.listen(port || process.env.PORT);
    this.server.on("request", this.requestHandler.bind(this));
    return this;
  }

  stop(callback?: () => unknown) {
    this.terminate.terminate().then(() => callback && callback());
  }

  private addControllers(controllers: object[]) {
    for (const controller of controllers) {
      const controllerBase: `/${string}` = Reflect.getMetadata(MetadataKeys.CONTROLLER_PATH, controller.constructor);
      const methodKeys: string[] = Reflect.getMetadata(MetadataKeys.AVAILABLE_ROUTE_METHODS, controller) || [];

      for (const methodKey of methodKeys) {
        const httpMethod: Method = Reflect.getMetadata(MetadataKeys.HTTP_METHOD, controller, methodKey);
        const schema: SchemaFunction | undefined = Reflect.getMetadata(MetadataKeys.SCHEMA, controller, methodKey);

        const routeName: string = Reflect.getMetadata(MetadataKeys.ROUTE_PATH, controller, methodKey);
        const endpoint = lead(controllerBase) + lead(routeName);

        if (httpMethod === "get" && schema) {
          throw new Error(`Method ${endpoint} cannot have a schema as it is a GET only route.`);
        }

        const handler = controller[methodKey as keyof typeof controller] as RequestHandler;

        if (schema) {
          this[httpMethod](endpoint, (req, res) => {
            try {
              const result = schema(req.body);

              if (result === false) {
                throw new ValidationException();
              }

              req.body = result;

              return handler(req, res);
            } catch (e) {
              if (this.kaitoOptions.onError) {
                this.kaitoOptions.onError(e, req, res);
              } else {
                Kaito.defaultErrorHandler(e, req, res);
              }
            }
          });
        } else {
          this[httpMethod](endpoint, handler);
        }
      }
    }
  }

  static defaultErrorHandler(err: Error, req: KaitoRequest, res: KaitoResponse) {
    if (err instanceof HttpException) {
      return res.status(err.code).json({
        message: err.message,
        code: err.code,
        error: "HttpException",
      });
    } else {
      console.error(err);
      return res.status(500).json({
        message: "Something went wrong on our side",
        error: err.constructor.name,
        code: 500,
      });
    }
  }
}

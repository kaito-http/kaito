/* eslint-disable @typescript-eslint/ban-types */
import "reflect-metadata";
import {
  KaitoAdvancedJsonType,
  KaitoAdvancedTextType,
  KaitoRequest,
  KaitoReturnType,
  MetadataKeys,
  Method,
  RequestHandler,
  SchemaFunction,
  ServerConstructorOptions,
} from "./types";
import Trouter, { HTTPMethod } from "trouter";
import http, { IncomingMessage, ServerResponse } from "http";

import { lead, parse } from "./utils/url";
import querystring from "querystring";
import { HttpException, ValidationException } from "./exceptions";

export class Kaito extends Trouter<RequestHandler> {
  readonly kaitoOptions;
  readonly server = http.createServer();

  constructor(options: ServerConstructorOptions) {
    super();
    this.addControllers(options.controllers);
    this.requestHandler = this.requestHandler.bind(this);
    this.kaitoOptions = options;
  }

  static waitForStream(request: IncomingMessage): Promise<string> {
    let body = "";

    return new Promise((resolve) => {
      request.on("data", (chunk: Buffer) => (body += chunk.toString()));
      request.on("end", () => resolve(body));
    });
  }

  private async requestHandler(request: IncomingMessage, response: ServerResponse) {
    const { handlers, params } = this.find((request.method as HTTPMethod) || "GET", request.url || "/");

    if (!request.url) return;

    const parsed = parse(request.url);

    const body = await Kaito.waitForStream(request);

    const req: KaitoRequest = {
      body: request.headers["content-type"]?.toLowerCase() === "application/json" ? JSON.parse(body) : body,
      params,
      pathname: "",
      query: querystring.parse(request.url),
      raw: request,
      url: parsed,
      res: response,
    };

    for (const handler of handlers) {
      const result = (await handler(req)) as KaitoReturnType<unknown>;

      if (result === undefined) {
        return req.res.end();
      }

      if (typeof result === "object") {
        if (result === null) {
          req.res.end();
          // TODO: Improve this error message to be more specific
          throw new Error("Cannot return null");
        }

        if ("json" in result) {
          const { json, status = 200, headers = {} } = result as KaitoAdvancedJsonType<unknown>;

          response.writeHead(status, {
            "Content-Type": "application/json",
            ...headers,
          });

          response.end(JSON.stringify(json));
        } else if ("text" in result) {
          const { text, status = 200, headers = {} } = result as KaitoAdvancedTextType;

          response.writeHead(status, {
            "Content-Type": "text/plain",
            ...headers,
          });

          response.end(text);
        } else {
          response.writeHead(200, {
            "Content-Type": "application/json",
          });

          response.end(JSON.stringify(result));
        }
      } else {
        response.writeHead(200, {
          "Content-Type": "application/json",
        });

        response.end(JSON.stringify(result));
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

  stop(callback?: (error?: Error) => unknown) {
    this.server.close(callback);
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
          this[httpMethod](endpoint, (req) => {
            try {
              const result = schema(req.body);

              if (result === false) {
                throw new ValidationException();
              }

              req.body = result;

              return handler(req);
            } catch (e) {
              if (this.kaitoOptions.onError) {
                this.kaitoOptions.onError(e, req);
              } else {
                Kaito.defaultErrorHandler(e, req);
              }
            }
          });
        } else {
          this[httpMethod](endpoint, handler);
        }
      }
    }
  }

  static defaultErrorHandler(err: Error, req: KaitoRequest) {
    req.res.setHeader("Content-Type", "application/json");

    if (err instanceof HttpException) {
      req.res.statusCode = err.code;

      const body = JSON.stringify({
        message: err.message,
        code: err.code,
        error: "HttpException",
      });

      req.res.end(body);
    } else {
      console.error(err);
      req.res.statusCode = 500;

      const body = JSON.stringify({
        message: "Something went wrong on our side",
        error: err.constructor.name,
        code: 500,
      });

      req.res.end(body);
    }
  }
}

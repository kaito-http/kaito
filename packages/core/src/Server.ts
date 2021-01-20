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
import Trouter, { FindResult, HTTPMethod } from "trouter";
import http, { IncomingMessage, OutgoingMessage } from "http";
import { lead, parse } from "./utils/url";
import querystring from "querystring";

export class Server extends Trouter {
  readonly server: http.Server;

  constructor(options: ServerConstructorOptions) {
    super();
    this.server = http.createServer();
    this.addControllers(options.controllers);
    this.requestHandler = this.requestHandler.bind(this);
  }

  private async requestHandler(request: IncomingMessage, response: OutgoingMessage) {
    const { handlers, params } = this.find(
      (request.method as HTTPMethod) || "GET",
      request.url || "/"
    ) as FindResult<RequestHandler>;

    if (!request.url) return;

    const parsed = parse(request.url);

    const req: KaitoRequest = {
      body: request,
      params,
      pathname: "",
      query: querystring.parse(request.url),
      raw: request,
      url: parsed,
    };

    const res: KaitoResponse = {
      json(body: unknown): void {
        response.setHeader("Content-Type", "application/json");
        response.write(JSON.stringify(body));
        response.end();
      },
      text(body: string) {
        response.setHeader("Content-Type", "text/plain");
        response.write(body);
        response.end();
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
    this.server.on("request", this.requestHandler);
    return this;
  }

  stop(callback?: (err?: Error) => unknown) {
    this.server.off("request", this.requestHandler);
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

        const handler = controller[methodKey as keyof typeof controller];

        this[httpMethod](endpoint, handler);
      }
    }
  }
}

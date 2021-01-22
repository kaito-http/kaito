/* eslint-disable @typescript-eslint/ban-types */
import "reflect-metadata";
import { KaitoAdvancedJsonType, KaitoAdvancedTextType, RequestHandler, ServerConstructorOptions } from "./types";
import Trouter, { HTTPMethod } from "trouter";
import http, { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from "http";

import { parse } from "./utils/url";
import querystring from "querystring";
import { defaultErrorHandler } from "./utils/errors";
import { Context } from "./structs/Context";
import { readControllerMetadata } from "./utils/metadata";

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

    const ctx = new Context({
      body: request.headers["content-type"]?.toLowerCase() === "application/json" ? JSON.parse(body) : body,
      params,
      pathname: "",
      query: querystring.parse(request.url),
      raw: request,
      url: parsed,
      res: response,
    });

    const handler = handlers[0];

    let result: unknown;

    try {
      result = await handler(ctx);
    } catch (e) {
      if (this.kaitoOptions.onError) {
        return this.kaitoOptions.onError(e, ctx);
      } else {
        return defaultErrorHandler(e, ctx);
      }
    }

    const sendJson = (data: unknown, status = 200, headers: OutgoingHttpHeaders = {}) => {
      response
        .writeHead(status, {
          "Content-Type": "application/json",
          ...headers,
        })
        .end(JSON.stringify(data));
    };

    if (typeof result === "object" && result !== null) {
      if ("json" in result) {
        const { json, status = 200, headers } = result as KaitoAdvancedJsonType<unknown>;
        sendJson(json, status, headers);
      } else if ("text" in result) {
        const { text, status = 200, headers } = result as KaitoAdvancedTextType;
        response.writeHead(status, { "Content-Type": "text/plain", ...headers }).end(text);
      } else {
        sendJson(result);
      }
    } else {
      sendJson(result);
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
      const metadata = readControllerMetadata(controller);

      for (const route of metadata.routes) {
        const { method, schema, path, methodName } = route;

        if (method === "get" && schema) {
          throw new Error(`Method ${methodName} (${path}) cannot have a schema as it is a GET only route.`);
        }

        const handler = controller[methodName] as RequestHandler;

        this[method](path, async (ctx) => {
          if (schema) {
            ctx.body = await schema.validate(ctx.body);
          }

          return handler(ctx);
        });
      }
    }
  }
}

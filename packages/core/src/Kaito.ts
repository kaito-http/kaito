/* eslint-disable @typescript-eslint/ban-types */
import "reflect-metadata";

import { KaitoContext, RequestHandler, ServerConstructorOptions } from "./types";
import { readControllerMetadata } from "./utils/metadata";
import { App } from "@tinyhttp/app";
import { Server } from "http";
import { defaultErrorHandler } from "./utils/errors";
import { blue, bold } from "colorette";
import { IncomingMessage } from "node:http";

export class Kaito extends App {
  readonly kaitoOptions;
  readonly server: Server | null = null;

  constructor(options: ServerConstructorOptions) {
    super({
      settings: { xPoweredBy: "kaito.cloud" },
    });

    this.addControllers(options.controllers);
    this.kaitoOptions = options;

    this.use = this.use.bind(this);
  }

  async parseBody<T>(req: IncomingMessage): Promise<T | null> {
    const get = async () => {
      let chunks = "";
      for await (const chunk of req) chunks += chunk;
      return chunks;
    };

    switch (req.headers["content-type"]?.toLowerCase()) {
      case "application/json": {
        return JSON.parse(await get());
      }

      default:
        return null;
    }
  }

  /**
   * Listen on the specified port. If no port is specified, it will try to use the environment variable PORT
   * @param port
   */
  listen(port?: string | number): Server {
    const parsed =
      (typeof port === "string" ? parseInt(port) : port) ||
      (process.env.PORT && parseInt(process.env.PORT)) ||
      undefined;

    // intentionally setting readonly property
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.server = super.listen(parsed, () => this.log(`starting on ${parsed}`));

    return this.server;
  }

  /**
   * Prints something to the terminal if logging is enabled
   * @param args Anything to be logged
   */
  protected log(...args: unknown[]) {
    if (this.kaitoOptions.logging) {
      console.log(blue(bold("[kaito/core]")), ...args);
    }
  }

  /**
   * Close and stop the server (useful for tests)
   * @param cb Callback
   * @returns
   */
  close(cb?: (err?: Error) => unknown) {
    this.log("shutting down");

    if (!this.server) {
      this.log("trying to close a server that was never started");
      cb?.(new Error("Could not close a server that was never started"));
      return;
    }

    try {
      this.server.removeAllListeners();
      this.server.close(cb);

      // intentionally setting readonly property
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.server = null;

      cb?.();
    } catch (e) {
      cb?.(e);
    }
  }

  /**
   * Add controllers and mount them to tinyhttp
   * @param controllers An array of controllers
   */
  private addControllers(controllers: object[]) {
    for (const controller of controllers) {
      const { routes } = readControllerMetadata(controller);

      for (const route of routes) {
        const { method, schema, path, methodName, querySchema } = route;

        if (method === "get" && schema) {
          throw new Error(`Method ${methodName} (${path}) cannot have a schema as it is a GET only route.`);
        }

        const handler = controller[methodName] as RequestHandler;

        this[method](path, async (req, res) => {
          const ip = (req.headers["x-forwarded-for"] || req.connection.remoteAddress || req.ip) as string;

          const ctx: KaitoContext = {
            body: await this.parseBody(req),
            params: req.params as Record<string, string>,
            path: req.path,
            query: req.query,
            url: req.url,
            req,
            res,
            ip,
          };

          try {
            if (querySchema) {
              ctx.query = await querySchema.parseAsync(ctx.query);
            }

            if (schema) {
              ctx.body = await schema.parseAsync(ctx.body);
            }

            const result = await handler(ctx);

            res
              .writeHead(result?.status ?? 200, { "Content-Type": "application/json", ...result?.headers })
              .end(JSON.stringify(result?.body ?? "OK"));
          } catch (e) {
            if (this.kaitoOptions.onError) {
              this.kaitoOptions.onError(e, ctx);
            } else {
              defaultErrorHandler(e, ctx);
            }
          }
        });
      }
    }
  }
}

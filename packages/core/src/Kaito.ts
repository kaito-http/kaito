/* eslint-disable @typescript-eslint/ban-types */
import "reflect-metadata";

import { KaitoContext, RequestHandler, ServerConstructorOptions } from "./types";
import { readControllerMetadata } from "./utils/metadata";
import { App } from "@tinyhttp/app";
import { Server } from "http";
import { defaultErrorHandler } from "./utils/errors";

export class Kaito extends App {
  readonly kaitoOptions;
  readonly server: Server | null = null;

  constructor(options: ServerConstructorOptions) {
    super();

    this.addControllers(options.controllers);
    this.kaitoOptions = options;
    this.use = this.use.bind(this);
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

  protected log(...args: unknown[]) {
    if (this.kaitoOptions.logging) {
      console.log("[kaito/core]", ...args);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  close(cb: (err?: Error) => unknown = () => {}) {
    if (this.kaitoOptions.logging) {
      this.log("shutting down");
    }

    if (this.server) {
      this.server.removeAllListeners();
      this.server.close(cb);

      // intentionally setting readonly property
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.server = null;
      return;
    }

    cb();
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

        this[method](path, async (req, res) => {
          const ctx: KaitoContext = {
            body: req.body,
            params: req.params as Record<string, string>,
            path: req.path,
            query: req.query,
            url: req.url,
            req,
            res,
          };

          try {
            if (schema) {
              ctx.body = await schema.validate(ctx.body);
            }

            const result = await handler(ctx);

            res.json(result);
          } catch (e) {
            defaultErrorHandler(e, ctx);
          }
        });
      }
    }
  }
}

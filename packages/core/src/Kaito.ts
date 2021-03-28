/* eslint-disable @typescript-eslint/ban-types */
import "reflect-metadata";

import { KaitoContext, RequestHandler, ServerConstructorOptions } from "./types";
import { readControllerMetadata } from "./utils/metadata";
import { App } from "@tinyhttp/app";
import { Server } from "http";
import { defaultErrorHandler } from "./utils/errors";
import { KatioReply } from "./utils/reply";
import bp from "body-parser";

export class Kaito extends App {
  readonly kaitoOptions;
  readonly server: Server | null = null;

  constructor(options: ServerConstructorOptions) {
    super({
      settings: {
        xPoweredBy: "kaito.cloud",
      },
    });

    this.addControllers(options.controllers);
    this.kaitoOptions = options;

    this.use = this.use.bind(this);

    this.use(bp.urlencoded({ extended: true }));
    this.use(bp.json());
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
            body: req.body,
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
              ctx.query = querySchema.parse(ctx.query);
            }

            if (schema) {
              ctx.body = await schema.parse(ctx.body);
            }

            const result = await handler(ctx);

            if (result instanceof KatioReply) {
              for (const [k, v] of Object.entries(result.data.headers ?? {})) {
                if (!v) continue;
                res.setHeader(k, v);
              }

              res.status(result.data.status ?? 200).json(result.data.json);

              return;
            }

            res.json(result);
          } catch (e) {
            this.log(e);
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

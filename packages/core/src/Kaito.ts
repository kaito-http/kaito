/* eslint-disable @typescript-eslint/ban-types */
import "reflect-metadata";

import { KaitoContext, RequestHandler, ServerConstructorOptions } from "./types";
import { readControllerMetadata } from "./utils/metadata";
import { App } from "@tinyhttp/app";

export class Kaito extends App {
  readonly kaitoOptions;

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
  listen(port?: string | number) {
    return super.listen(
      (typeof port === "string" ? parseInt(port) : port) ||
        (process.env.PORT && parseInt(process.env.PORT)) ||
        undefined
    );
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

          if (schema) {
            ctx.body = await schema.validate(ctx.body);
          }

          const result = await handler(ctx);

          res.json(result);
        });
      }
    }
  }
}

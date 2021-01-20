/* eslint-disable @typescript-eslint/ban-types */
import "reflect-metadata";
import express, { ErrorRequestHandler, NextFunction, RequestHandler, Request, Response } from "express";
import { MetadataKeys, Method, SchemaFunction } from "./types";
import { HttpException, ValidationException } from "./exceptions";
import cookieParser from "cookie-parser";
import "express-async-errors";
import * as http from "http";

export class Server {
  readonly app = express();
  readonly _server: http.Server;

  constructor(port: number | string, controllers: object[]) {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());

    this.addControllers(controllers);
    this.app.use(Server.errorHandler);

    this._server = this.app.listen(port);
  }

  stop() {
    this._server.close();
  }

  private addControllers(controllers: object[]) {
    for (const controller of controllers) {
      const controllerBase: `/${string}` = Reflect.getMetadata(MetadataKeys.CONTROLLER_PATH, controller.constructor);
      const methodKeys: string[] = Reflect.getMetadata(MetadataKeys.AVAILABLE_ROUTE_METHODS, controller) || [];

      for (const methodKey of methodKeys) {
        const httpMethod: Method = Reflect.getMetadata(MetadataKeys.HTTP_METHOD, controller, methodKey);
        const routeName: string = Reflect.getMetadata(MetadataKeys.ROUTE_PATH, controller, methodKey);
        const handler: RequestHandler = controller[methodKey as keyof typeof controller];

        const endpoint = controllerBase + routeName;
        const schema: SchemaFunction | undefined = Reflect.getMetadata(MetadataKeys.SCHEMA, controller, methodKey);

        if (httpMethod === "get" && schema) {
          throw new Error(`Method ${endpoint} cannot have a schema as it is a GET only route.`);
        }

        if (schema) {
          const mw: RequestHandler = async (req, res, next) => {
            const result = await schema(req.body);

            if (result === false) {
              throw new ValidationException();
            }

            req.body = result;

            next();
          };

          this.app[httpMethod](endpoint, mw, handler);
        } else {
          this.app[httpMethod](endpoint, handler);
        }
      }
    }
  }

  static readonly errorHandler: ErrorRequestHandler = (
    err: Error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction
  ) => {
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
  };
}

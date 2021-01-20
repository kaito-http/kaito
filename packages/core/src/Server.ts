/* eslint-disable @typescript-eslint/ban-types */
import "reflect-metadata";
import { MetadataKeys, Method, SchemaFunction, ServerConstructorOptions } from "./types";
import Trouter from "trouter";
import http from "http";

export class Server extends Trouter {
  readonly server: http.Server;

  constructor(options: ServerConstructorOptions) {
    super();
    this.server = http.createServer();
    this.addControllers(options.controllers);
  }

  /**
   * Listen on the specified port. If no port is specified, it will try to use the environment variable PORT
   * @param port
   */
  listen(port?: string | number) {
    this.server.listen(port || process.env.PORT);
  }

  private addControllers(controllers: object[]) {
    for (const controller of controllers) {
      const controllerBase: `/${string}` = Reflect.getMetadata(MetadataKeys.CONTROLLER_PATH, controller.constructor);
      const methodKeys: string[] = Reflect.getMetadata(MetadataKeys.AVAILABLE_ROUTE_METHODS, controller) || [];

      for (const methodKey of methodKeys) {
        const httpMethod: Method = Reflect.getMetadata(MetadataKeys.HTTP_METHOD, controller, methodKey);
        const schema: SchemaFunction | undefined = Reflect.getMetadata(MetadataKeys.SCHEMA, controller, methodKey);

        const routeName: string = Reflect.getMetadata(MetadataKeys.ROUTE_PATH, controller, methodKey);
        const endpoint = controllerBase + routeName;

        if (httpMethod === "get" && schema) {
          throw new Error(`Method ${endpoint} cannot have a schema as it is a GET only route.`);
        }

        const handler = controller[methodKey as keyof typeof controller];

        // todo
      }
    }
  }
}

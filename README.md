# `kaito-http`

### typescript http framework built on top of express

### installation

`yarn add kaito-http` (or, with npm `npm i --save kaito-http`)

### why the name kaito?

this project is in memory of a close japanese friend of mine, called kaito

### features

- ✍ built in schema + body validation support
- ⚡ ultra quick, built on top of express
- 💪 robust
- 💨 extremely easy to use, built with decorators

#### example

```ts
import { Request, Response } from "express";

@Controller("/")
class Home {
  @Get("/")
  async get(req: Request, res: Response) {
    res.json({ success: true });
  }

  @Post("/")
  @Schema<{ name: string }>(async (body) => typeof body?.name === "string")
  async post(req: Request, res: Response) {
    res.json(req.body);
  }
}

const server = new Server(process.env.PORT || "8080", [new Home()]);
```

### available decorators

##### methods

- `@Get` - for GET requests. You cannot use an `@Schema` with this method
- `@Post` – POST requests
- `@Patch` – PATCH requests (usually mutations)
- `@Put` – POST requests (usually insertions)
- `@Delete` – POST requests (usually deletions)

#### utility

- `@Schema` - lets you check a request body to match a certain schema. if this function returns `true`, req.body will be exactly as sent in the request. if the function returns `false`, the request will fail, and an error will be thrown and caught. if the function returns neither true nor false, the request will continue, and the result from the schema function will be the value of `req.body`
- `@Controller` - tells `Reflect` that this class is a controller, and mounts your methods onto the express instance

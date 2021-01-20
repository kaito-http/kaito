# `kaito-http`

### typescript http framework built on top of express

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
  @Schema<{ name: string }>((body) => typeof body?.name === "string")
  async echo(req: Request, res: Response) {
    res.json(req.body);
  }

  @Put("/")
  @Schema<{ something: boolean }>((body) => body?.something === true)
  async putSomething(req: Request, res: Response) {
    await database.insert({ something: req.body.something });
    res.json(req.body);
  }
}

const server = new Server(process.env.PORT || "8080", [new Home()]);
```

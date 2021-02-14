import { Kaito, Controller, Get, Post, Schema, KTX, KRT, InferType, json } from "../src";
import fetch from "node-fetch";
import * as yup from "yup";

const testingSchema = yup.object({ name: yup.string().required() }).required();

@Controller("/test")
class Home {
  @Get("/get")
  async get(): KRT<{ success: boolean }> {
    return { success: true };
  }

  @Get("/:value")
  async param(ctx: KTX): KRT<{ hello: string }> {
    return { hello: ctx.params.value as string };
  }

  @Post("/post")
  @Schema(testingSchema)
  async post(ctx: InferType<typeof testingSchema>): KRT<{ name: string }> {
    return ctx.body;
  }
}

const app = new Kaito({
  controllers: [new Home()],
});

app.listen(8080);
app.use(json);

describe("core-http", () => {
  it("GET / with a correct endpoint", async () => {
    const res = await fetch("http://localhost:8080/test/get");
    expect(await res.json()).toEqual({ success: true });
  });

  it("POST / with a valid body", async () => {
    const res = await fetch("http://localhost:8080/test/post", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hey" }),
      method: "POST",
    });

    expect(res.status).toBe(200);
  });

  it("GET with a query param", async () => {
    const p = Math.floor(Math.random() * 1000).toString();
    const res = await fetch(`http://localhost:8080/test/${p}`);
    expect(await res.json()).toEqual({ hello: p });
  });

  it("POST / with an invalid body", async () => {
    const res = await fetch("http://localhost:8080/test/post", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ age: 10 }),
      method: "POST",
    });

    expect(res.status).toBe(422);
  });
});

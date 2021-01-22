import { Kaito, Controller, Get, Post, Schema, KTX, KRT } from "../src";
import fetch from "node-fetch";
import * as yup from "yup";

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
  @Schema(yup.object({ name: yup.string().required() }).required())
  async post(ctx: KTX<{ name: string }>): KRT<{ name: string }> {
    return ctx.body;
  }
}

const app = new Kaito({
  controllers: [new Home()],
}).listen(8080);

describe("core-http", () => {
  afterAll(() => app.stop());

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

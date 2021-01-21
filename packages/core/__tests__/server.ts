import { Kaito, Controller, Get, Post, Schema, KRQ, KRT } from "../src";
import fetch from "node-fetch";

@Controller("/")
class Home {
  @Get("/")
  async get(): KRT<{ success: boolean }> {
    return { success: true };
  }

  @Post("/")
  @Schema<{ name: string }>((body) => typeof body?.name === "string")
  async post(req: KRQ<{ name: string }>): KRT<{ name: string }> {
    return req.body;
  }
}

const app = new Kaito({
  controllers: [new Home()],
}).listen(8080);

describe("core-http", () => {
  afterAll(() => app.stop());

  it("GET / with a correct endpoint", async () => {
    const res = await fetch("http://localhost:8080/");
    expect(await res.json()).toEqual({ success: true });
  });

  it("POST / with a valid body", async () => {
    const res = await fetch("http://localhost:8080/", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hey" }),
      method: "POST",
    });

    expect(res.status).toBe(200);
  });

  it("POST / with an invalid body", async () => {
    const res = await fetch("http://localhost:8080/", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ age: 10 }),
      method: "POST",
    });

    expect(res.status).toBe(422);
  });
});

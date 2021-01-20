import { Server, Controller, Get, Post, Schema } from "../src";
import { Request, Response } from "express";
import fetch from "node-fetch";

@Controller("/")
class Home {
  @Get("/")
  async get(req: Request, res: Response) {
    res.json({ success: true });
  }

  @Post("/")
  @Schema<{ name: string }>((body) => typeof body?.name === "string")
  async post(req: Request, res: Response) {
    res.json(req.body);
  }
}

const app = new Server(process.env.PORT || "8080", [new Home()]);

describe("kaito-http", () => {
  afterAll(() => {
    app.stop();
  });

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

import fetch from "node-fetch";
import { app } from "../jest-server";

describe("core-http", () => {
  afterEach(() => {
    app.close();
  });

  beforeEach(() => {
    app.listen(8080);
  });

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

    expect(res.status).toBe(204);
    expect(res.headers.get("X-Example")).toBeTruthy();
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

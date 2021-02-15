import { Kaito, Controller, Get, Post, Schema, KTX, KRT, InferType, r } from "./src";
import * as yup from "yup";

const testingSchema = yup.object({ name: yup.string().required() }).required();

@Controller("/test")
class Home {
  @Get("/get")
  async get(): KRT<{ success: boolean }> {
    return { success: true };
  }

  @Get("/:value")
  async param(ctx: KTX<null, null, { value: string }>): KRT<{ hello: string }> {
    return { hello: ctx.params.value };
  }

  @Post("/post")
  @Schema(testingSchema)
  async post(ctx: InferType<typeof testingSchema>): KRT<{ name: string }> {
    return r({
      json: ctx.body,
      status: 204,
      headers: {
        "X-Example": "Mad ratio",
      },
    });
  }
}

export const app = new Kaito({
  controllers: [new Home()],
  logging: true,
});

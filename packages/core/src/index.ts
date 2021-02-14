/* eslint-disable @typescript-eslint/no-explicit-any */

import { KTX } from "./types";

export { Kaito } from "./Kaito";
export * from "./decorators";
export * from "./exceptions";
export * from "./types";
export * from "./middleware";

import { InferType as YupInferType } from "yup";

type TypedSchema = {
  __inputType: any;
  __outputType: any;
};

export type InferType<T extends TypedSchema> = KTX<YupInferType<T>>;

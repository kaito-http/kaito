import { KaitoAdvancedJsonType } from "../types";

/**
 * Shorthand method to generate an advanced reply
 * @param t
 */
export function r<T>(t: KaitoAdvancedJsonType<T>) {
  return new Reply(t);
}

export class Reply<T> {
  public readonly __at = new Date();
  constructor(public readonly data: KaitoAdvancedJsonType<T>) {}
}

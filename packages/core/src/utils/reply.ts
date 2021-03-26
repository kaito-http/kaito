import { KaitoAdvancedJsonType } from "../types";

/**
 * Shorthand method to generate an advanced reply
 * @param t
 */
export function reply<T>(t: KaitoAdvancedJsonType<T>) {
  return new KatioReply(t);
}

export class KatioReply<T> {
  public readonly __at = new Date();
  constructor(public readonly data: KaitoAdvancedJsonType<T>) {}
}

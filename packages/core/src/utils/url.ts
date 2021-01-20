import { KaitoRequest } from "../types";
import urlite from "urlite";

/**
 * Reference: https://www.eso.org/~ndelmott/ascii.html
 */
const FORWARD_SLASH_CHAR_CODE = 47;

export function parse(req: KaitoRequest) {
  if (!req.raw.url) return null;
  return urlite.parse(req.raw.url);
}

export function lead(path: string): string {
  // Faster than using .startsAt as memory is not allocated for a substring
  return path.charCodeAt(0) === FORWARD_SLASH_CHAR_CODE ? path : "/" + path;
}

export type ParsedUrl = ReturnType<typeof urlite.parse>;

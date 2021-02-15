/**
 * Reference: https://www.eso.org/~ndelmott/ascii.html
 */
const FORWARD_SLASH_CHAR_CODE = 47;

export function normalizePath(base: string, path: string) {
  return lead(base) + lead(path);
}

export function lead(path: string): string {
  // Faster than using .startsAt as memory is not allocated for a substring
  return path.charCodeAt(0) === FORWARD_SLASH_CHAR_CODE ? path : "/" + path;
}

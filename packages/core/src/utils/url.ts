const URL_REGEX = /([^:/?#]+:)?(?:(?:\/\/)(?:([^/?#]*:[^@/]+)@)?([^/:?#]+)(?:(?::)(\d+))?)?(\/?[^?#]*)?(\?[^#]*)?(#[^\s]*)?/;
const URL_FRAGMENTS = ["protocol", "auth", "hostname", "port", "pathname", "search", "hash"] as const;

/**
 * Reference: https://www.eso.org/~ndelmott/ascii.html
 */
const FORWARD_SLASH_CHAR_CODE = 47;

export type ParsedUrl = {
  auth: string;
  hash: string;
  hostname: string;
  path: string;
  pathname: string;
  port: string;
  protocol: string;
  search: string;
};

export function parse(url: string) {
  const parts: Partial<ParsedUrl> = {};

  const matches = url.match(URL_REGEX);
  let l = URL_FRAGMENTS.length;

  while (l--) {
    const next = l + 1;
    parts[URL_FRAGMENTS[l]] = (matches || [])[next];
  }

  parts.path = parts.search ? (parts.pathname ? parts.pathname + parts.search : parts.search) : parts.pathname;

  return parts as ParsedUrl;
}

export function generateEndpoint(base: string, path: string) {
  return lead(base) + lead(path);
}

export function lead(path: string): string {
  // Faster than using .startsAt as memory is not allocated for a substring
  return path.charCodeAt(0) === FORWARD_SLASH_CHAR_CODE ? path : "/" + path;
}

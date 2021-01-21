import { KaitoContext } from "../types";
import { ParsedUrl } from "../utils/url";
import { IncomingMessage, ServerResponse } from "http";
import * as querystring from "querystring";

export class Context<Body> implements KaitoContext {
  public readonly body: Body;
  public readonly params: Record<string, string | string[]>;
  public readonly pathname: string;
  public readonly query: querystring.ParsedUrlQuery;
  public readonly raw: IncomingMessage;
  public readonly res: ServerResponse;
  public readonly url: Partial<ParsedUrl> | null;

  constructor(data: KaitoContext<Body>) {
    this.body = data.body;
    this.params = data.params;
    this.pathname = data.pathname;
    this.query = data.query;
    this.raw = data.raw;
    this.res = data.res;
    this.url = data.url;
  }
}

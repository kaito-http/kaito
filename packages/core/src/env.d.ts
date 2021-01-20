declare module "urlite" {
  declare const urlite: {
    parse: (
      url: string
    ) => Partial<{
      auth: string;
      hash: string;
      hostname: string;
      href: string;
      path: string;
      pathname: string;
      port: string;
      protocol: string;
      search: string;
    }>;
  };

  export = urlite;
}

import React from "react";

export default {
  repository: "https://github.com/kaito-http/kaito",
  docsRepository: "https://github.com/kaito-http/kaito/tree/main/docs",
  branch: "main",
  path: "/",
  titleSuffix: " – core",
  nextLinks: true,
  prevLinks: true,
  search: true,
  customSearch: null,
  darkMode: true,
  footer: true,
  footerText: "MIT 2020 © Alistair Smith.",
  footerEditOnGitHubLink: true,
  logo: <span>Kaito</span>,
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="kaito: typescript http framework" />
      <meta name="og:title" content="kaito: typescript http framework" />
    </>
  ),
};

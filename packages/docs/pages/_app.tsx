import * as React from "react";
import "nextra-theme-docs/style.css";
import { AppProps } from "next/app";

export default function Nextra({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

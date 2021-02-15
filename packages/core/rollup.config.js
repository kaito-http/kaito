import typescript from "@rollup/plugin-typescript";

import base from "../../tsconfig.base.json";
import config from "./tsconfig.json";

export default {
  input: "./src/index.ts",
  output: {
    dir: "dist",
    format: "cjs",
    sourcemap: true,
  },
  treeshake: true,
  plugins: [
    typescript({
      ...base.compilerOptions,
      ...config.compilerOptions,
      module: "esnext",
      declaration: true,
      noEmit: false,
      rootDir: "src",
      outDir: "dist",
      sourceMap: true,
      exclude: ["node_modules", "dist", "jest.config.js", "jest-server.ts", "rollup.config.js", /__tests__/],
    }),
  ],
};

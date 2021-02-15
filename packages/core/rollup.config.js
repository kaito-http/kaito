import typescript from "rollup-plugin-ts";
import pkg from "./package.json";
import base from "../../tsconfig.base.json";
import config from "./tsconfig.json";
import eslint from "@rollup/plugin-eslint";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default {
  input: "./src/index.ts",
  output: [
    {
      file: pkg.main,
      format: "cjs",
      sourcemap: true,
    },
    {
      file: pkg.module,
      format: "es",
      sourcemap: true,
    },
  ],
  treeshake: true,
  plugins: [
    eslint({ throwOnWarning: true, include: "./src" }),
    nodeResolve(),
    commonjs(),
    typescript({
      ...base.compilerOptions,
      ...config.compilerOptions,
      typescript: require("typescript"),
      tsconfig: {
        module: "esnext",
        declaration: true,
        noEmit: false,
        rootDir: "src",
        outDir: "dist",
        sourceMap: true,
        target: "es2019",
      },
      exclude: ["node_modules", "dist", "jest.config.js", "jest-server.ts", "rollup.config.js", /__tests__/],
    }),
  ],
  external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
};

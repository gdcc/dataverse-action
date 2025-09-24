import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";

const config = [
    {
        input: "src/index.js",
        output: {
            esModule: true,
            file: "dist/index.js",
            format: "es",
            sourcemap: true,
        },
        plugins: [commonjs(), json(), nodeResolve({ preferBuiltins: true })],
    },
    {
        input: "src/post.js",
        output: {
            esModule: true,
            file: "dist/post.js",
            format: "es",
            sourcemap: true,
        },
        plugins: [commonjs(), json(), nodeResolve({ preferBuiltins: true })],
    },
];

export default config;
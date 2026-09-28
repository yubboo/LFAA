/** 为放在仓库根 dist/server 的编译产物注册本 package 的 ESM 依赖解析器。 */
import { register } from "node:module";

register("./package-loader.mjs", import.meta.url);

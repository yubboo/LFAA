// 将画布 Host 插件打包为默认入口，公开契约保留编译后的独立入口。
import { defineConfig } from "tsdown";

export default defineConfig({ entry: ["lib/types/src/index.js"] });

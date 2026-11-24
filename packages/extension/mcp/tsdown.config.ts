// MCP 能力包构建入口，源码与公开契约使用同一 TypeScript 工程。
import { defineConfig } from "tsdown";

export default defineConfig({ entry: ["lib/types/src/index.js"] });

// @lfaa/llm 构建入口：主入口、方舟套餐路由与千问 Token Plan 目录三个公开子路径。
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["lib/types/index.js", "lib/types/ark-plan.js", "lib/types/token-plan.js"],
});

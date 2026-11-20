// @lfaa/llm 构建入口：主入口与方舟套餐路由两个公开子路径。
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["lib/types/index.js", "lib/types/ark-plan.js"],
});

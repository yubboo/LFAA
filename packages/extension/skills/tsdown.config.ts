// @lfaa/skills 构建入口：主入口在 lib/types/src 下（契约与源码同工程），并随产物复制内置技能文档。
import { cpSync, existsSync } from "node:fs";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["lib/types/src/index.js"],
  onSuccess: () => {
    if (existsSync("src/builtin-skills")) {
      cpSync("src/builtin-skills", "lib/builtin-skills", { recursive: true });
    }
  },
});

// @lfaa/skills 构建入口：主入口在 lib/types/src 下（契约与源码同工程），并随产物复制内置技能文档。
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["lib/types/src/index.js"],
  onSuccess: () => {
    const srcDir = resolve(import.meta.dirname, "src/builtin-skills");
    const outDir = resolve(import.meta.dirname, "lib/builtin-skills");
    if (existsSync(srcDir)) {
      cpSync(srcDir, outDir, { recursive: true, force: true });
    }
  },
});

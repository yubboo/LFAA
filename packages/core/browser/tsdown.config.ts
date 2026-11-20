// @lfaa/browser 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["lib/types/src/index.js"],
});

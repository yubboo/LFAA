// @lfaa/ui-icons 构建入口：主入口在 lib/types/src 下（契约与源码同工程），Client 组件由 ./client 源码直出。
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["lib/types/src/index.js"],
});
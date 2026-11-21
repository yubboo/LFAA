// 桌面宿主构建：只打包本进程源码；@lfaa/* 保持外部依赖（安装包内由 node_modules 提供）。
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "lib",
  platform: "node",
  format: ["esm"],
  target: "es2022",
  fixedExtension: false,
  dts: false,
  clean: true,
  deps: { neverBundle: [/^@lfaa\//u] },
});
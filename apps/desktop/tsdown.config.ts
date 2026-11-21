// 桌面主进程构建：只打包本地源码；Electron 与 workspace 包保持外部依赖（由安装包内 node_modules 提供）。
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/main.ts"],
  outDir: "dist",
  platform: "node",
  format: ["esm"],
  target: "es2022",
  fixedExtension: false,
  dts: false,
  clean: true,
  // neverBundle：运行时从 node_modules 解析，避免把 Cordis 包与 Electron 打进单一文件。
  deps: { neverBundle: ["electron", /^@lfaa\//u] },
});
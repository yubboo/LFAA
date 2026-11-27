// 桌面主进程与 Preload 桥构建：均输出 CJS，规避 Electron 45 Windows ESM 加载器对盘符根 lstat 报 EPERM。
import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/main.ts"],
    outDir: "dist",
    platform: "node",
    format: ["cjs"],
    target: "es2022",
    fixedExtension: true,
    dts: false,
    clean: true,
    deps: { neverBundle: ["electron", /^@lfaa\//u] },
  },
  {
    entry: ["src/preload.ts"],
    outDir: "dist",
    platform: "node",
    format: ["cjs"],
    target: "es2022",
    fixedExtension: true,
    dts: false,
    clean: false,
    deps: { neverBundle: ["electron"] },
  },
]);

// 桌面主进程与 Preload 桥构建：主进程输出 ESM，Preload 输出 CJS（供 Electron sandbox: true 安全加载）。
import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/main.ts"],
    outDir: "dist",
    platform: "node",
    format: ["esm"],
    target: "es2022",
    fixedExtension: false,
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

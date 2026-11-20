// 配置 Web 开发服务器、React 转换和生产构建。
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // 工作区指标包的输出由 Host 构建更新，开发页直接读取，避免沿用旧的预打包统计逻辑。
  optimizeDeps: { exclude: ["@lfaa/metrics"] },
  server: {
    host: "127.0.0.1",
  },
  preview: {
    host: "127.0.0.1",
  },
});

/**
 * 功能：配置 LFAA Web 前端开发服务器和生产构建。
 * 作用：启用 React 转换，并将本机开发时的 API 请求代理到控制端。
 * 关联文件：frontend/package.json、frontend/src/main.tsx、server/src/index.ts。
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../dist/frontend",
    emptyOutDir: true
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000"
    }
  }
});

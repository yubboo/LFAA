/**
 * 文件：apps/web/vite.config.ts
 * 作用：LFAA Web 产品的 Vite 构建与开发 Host 入口。
 * 负责：解析 App/Repo 路径与端口，并把 Host 组装委托给 @lfaa/bundle-web-app。
 * 不负责：任何业务 Controller、Provider、Terminal、Secret 或 Adapter 的具体实现。
 * 状态归属：无业务状态；只读取当前进程的端口环境变量。
 * 对外接口：Vite default config export。
 * 关联文件：packages/bundle/web-app/src/vite.ts、apps/web/src/main.ts。
 * 修改注意事项：这里必须保持薄；新增 Host 能力应进入 packages 并由 Bundle 组合。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { createLfaaWebViteConfig } from "@lfaa/bundle-web-app/vite";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(appRoot, "../..");
const devPort = Number.parseInt(process.env.LFAA_WEB_PORT ?? "5173", 10);
const previewPort = Number.parseInt(process.env.LFAA_WEB_PREVIEW_PORT ?? "4173", 10);

export default defineConfig(createLfaaWebViteConfig({
  appRoot,
  projectRoot,
  devPort: Number.isFinite(devPort) ? devPort : 5173,
  previewPort: Number.isFinite(previewPort) ? previewPort : 4173,
}));

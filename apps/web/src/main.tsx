/**
 * 文件：main.tsx
 * 作用：LFAA Web 的 React 浏览器启动入口。
 * 负责：寻找 #root 并在 StrictMode 下挂载 App。
 * 不负责：页面业务、资源桥接、工作台布局。
 * 状态归属：无业务状态。
 * 对外接口：无，作为 Vite HTML 入口被加载。
 * 关联文件：apps/web/index.html、App.tsx。
 * 修改注意事项：这里只保留应用启动职责，不把业务逻辑堆进入口文件。
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("LFAA Web root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * 功能：挂载 LFAA React 前端。
 * 作用：按固定级联顺序只加载一次全局基础、公共和页面样式，再呈现认证和应用中心入口。
 * 关联文件：apps/web/index.html、packages/client/ui-renderer/src/App.tsx、packages/client/ui-theme/src/tokens.css、base.css、common.css、responsive.css。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import "antd/dist/reset.css";
import "lfaa-client-ui-theme/src/tokens.css";
import "lfaa-client-ui-theme/src/base.css";
import "lfaa-client-ui-theme/src/common.css"; // 跨组件共用状态样式只在全局入口导入一次。
import "lfaa-client-ui-settings-account/src/auth.css";
import "lfaa-client-ui-layout/src/workbench.css";
import "lfaa-client-ui-layout/src/pages.css";
import "lfaa-client-ui-workspace/src/application-workspace.css";
import "lfaa-client-ui-theme/src/responsive.css";
import App from "./App.js";
import type { Context } from "@deepseek-ai/cordis";

export function mountClient(ctx: Context): void {
const root = ReactDOM.createRoot(document.getElementById("root")!);
ctx.effect(() => () => { root.unmount(); });
root.render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#3457d5",
          colorText: "#263247",
          colorTextSecondary: "#5d6a80",
          borderRadius: 10,
          fontFamily: "var(--font-family-sans)"
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);






}

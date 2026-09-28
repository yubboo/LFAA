/**
 * 功能：挂载 LFAA React 前端。
 * 作用：按固定级联顺序只加载一次全局基础、公共和页面样式，再呈现认证和应用中心入口。
 * 关联文件：frontend/index.html、frontend/src/App.tsx、frontend/src/styles/tokens.css、base.css、common.css、responsive.css。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import "antd/dist/reset.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/common.css"; // 跨组件共用状态样式只在全局入口导入一次。
import "./styles/auth.css";
import "./styles/workbench.css";
import "./styles/pages.css";
import "./styles/application-workspace.css";
import "./styles/responsive.css";
import App from "./App.js";

ReactDOM.createRoot(document.getElementById("root")!).render(
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






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
import "lfaa-client-ui-theme/src/dsh-theme-tokens.css";
import "lfaa-client-ui-theme/src/base.css";
import "lfaa-client-ui-theme/src/common.css"; // 跨组件共用状态样式只在全局入口导入一次。
import "lfaa-client-ui-settings-account/src/auth.css";
import "lfaa-client-ui-layout/src/workbench.css";
import "lfaa-client-ui-layout/src/pages.css";
import "lfaa-client-ui-workspace/src/application-workspace.css";
import "lfaa-client-ui-theme/src/responsive.css";
import App from "./App.js";
import type { Context } from "@deepseek-ai/cordis";
import { DshSlotRoot } from "lfaa-client-modules/src/client/index.js";
import { ClientRenderBoundary } from "./ClientRenderBoundary.js";
type DshUiHost = {
  slots?: { register(options: object, component: (props: { renderSlot: (name: string, owner: object, options?: { entryKey?: string; fallback?: React.ReactNode }) => React.ReactNode }) => React.ReactNode): () => void };
  uiRenderer?: { mount(container: HTMLElement): () => void };
};

export function mountClient(ctx: Context): void {
const container = document.getElementById("root")!;
const dsh = ctx as unknown as DshUiHost;
if (dsh.slots && dsh.uiRenderer) {
  const disposeRoot = dsh.slots.register({
    name: "root",
    children: {
      "settings.section": { kind: "list", scope: "root" },
      "sidebar.right.pane.tab": { kind: "keyed", scope: "root" },
      "shell.overlay": { kind: "list", scope: "root" }
    }
  }, ({ renderSlot }) => React.createElement(DshSlotRoot, {
    renderer: renderSlot,
    children: (
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
          <ClientRenderBoundary><App /></ClientRenderBoundary>
        </ConfigProvider>
      </React.StrictMode>
    )
  }));
  const unmount = dsh.uiRenderer.mount(container);
  ctx.effect(() => () => { unmount(); disposeRoot(); });
  return;
}

console.error("LFAA DSH UI Renderer 未就绪，当前页面使用本地 React 根；DSH 扩展槽不可用。 ");
const root = ReactDOM.createRoot(container);
ctx.effect(() => () => { root.unmount(); });
root.render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#3457d5", colorText: "#263247", colorTextSecondary: "#5d6a80", borderRadius: 10, fontFamily: "var(--font-family-sans)" } }}>
      <ClientRenderBoundary><App /></ClientRenderBoundary>
    </ConfigProvider>
  </React.StrictMode>
);






}

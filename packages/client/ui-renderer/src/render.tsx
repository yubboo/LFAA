/**
 * 功能：挂载 LFAA React 前端。
 * 作用：按固定级联顺序只加载一次全局基础、公共和页面样式，再呈现认证和小鱼智能体首页。
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
import "lfaa-client-ui-theme/src/common.css"; // 跨组件状态、共享卡片与弹窗动效只在全局入口导入一次。
import "lfaa-client-ui-settings-account/src/auth.css";
import "lfaa-client-ui-layout/src/workbench.css";
import "lfaa-client-ui-layout/src/pages.css";
import "lfaa-client-ui-theme/src/responsive.css";
import App from "./App.js";
import type { Context } from "@deepseek-ai/cordis";
import { DshSlotRoot, LFAA_AUTH_TRANSITION_SLOT, type DshSlotEntrySummary, type DshSlotRegistryReader } from "lfaa-client-modules/src/client/index.js";
import { ClientRenderBoundary } from "./ClientRenderBoundary.js";
type DshUiHost = {
  slots?: {
    register(options: object, component: (props: { renderSlot: (name: string, owner: object, options?: { entryKey?: string; only?: string; fallback?: React.ReactNode }) => React.ReactNode }) => React.ReactNode): () => void;
    entries?: (name: string) => readonly { options?: { id?: string; key?: string; label?: string | (() => string); order?: number } }[];
    subscribe?: (name: string, listener: () => void) => () => void;
  };
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
      [LFAA_AUTH_TRANSITION_SLOT]: { kind: "list", scope: "root" },
      "sidebar.right.pane.tab": { kind: "keyed", scope: "root" },
      "shell.overlay": { kind: "list", scope: "root" },
      "conversation.input.right": { kind: "list", scope: "root" },
      "plugins.add.actions": { kind: "list", scope: "root" },
      "plugins.tab": { kind: "list", scope: "root" },
      "plugins.bundle.activation": { kind: "keyed", scope: "root" },
      "plugins.item": { kind: "list", scope: "root" },
      "plugins.bundle.config": { kind: "keyed", scope: "root" },
      "plugins.row.config": { kind: "keyed", scope: "root" },
      "plugins.detail.actions": { kind: "list", scope: "root" },
      "plugins.detail.badge": { kind: "list", scope: "root" },
      "plugins.detail.section": { kind: "list", scope: "root" }
    }
  }, ({ renderSlot }) => React.createElement(DshSlotRoot, {
    renderer: renderSlot,
    registry: createDshSlotRegistry(dsh),
    children: (
      <React.StrictMode>
        <ConfigProvider
          locale={zhCN}
          theme={{
            token: {
              colorPrimary: "var(--settings-accent, var(--color-brand))",
              colorText: "var(--color-text-primary)",
              colorTextSecondary: "var(--color-text-secondary)",
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

function createDshSlotRegistry(host: DshUiHost): DshSlotRegistryReader | undefined {
  if (!host.slots?.entries || !host.slots.subscribe) return undefined;
  return {
    entries(name): readonly DshSlotEntrySummary[] {
      return host.slots!.entries!(name).flatMap(({ options }) => {
        if (!options) return [];
        const id = typeof options.id === "string" ? options.id : typeof options.key === "string" ? options.key : undefined;
        if (!id) return [];
        let label = options.label;
        if (typeof label === "function") {
          try { label = label(); } catch { label = undefined; }
        }
        return [{
          id,
          ...(typeof options.key === "string" ? { key: options.key } : {}),
          ...(typeof label === "string" ? { label } : {}),
          ...(typeof options.order === "number" ? { order: options.order } : {})
        }];
      });
    },
    subscribe(name, listener) { return host.slots!.subscribe!(name, listener); }
  };
}

console.error("LFAA DSH UI Renderer 未就绪，当前页面使用本地 React 根；DSH 扩展槽不可用。 ");
const root = ReactDOM.createRoot(container);
ctx.effect(() => () => { root.unmount(); });
root.render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "var(--settings-accent, var(--color-brand))", colorText: "var(--color-text-primary)", colorTextSecondary: "var(--color-text-secondary)", borderRadius: 10, fontFamily: "var(--settings-interface-font, var(--font-family-sans))" } }}>
      <ClientRenderBoundary><App /></ClientRenderBoundary>
    </ConfigProvider>
  </React.StrictMode>
);






}

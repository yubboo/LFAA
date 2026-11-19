// @lfaa/plugins 浏览器端 Cordis 插件：注册插件中心主视图，并随运行状态动态挂卸各扩展详情页。
import type { Context } from "@deepseek-ai/cordis";
import "@lfaa/ui-layout/client";
import type { PluginRecord } from "../contract/index";
import { fetchPluginsState } from "./plugins-client";
import { PluginsView } from "./Plugins-View";

function detectIsZh(): boolean {
  if (typeof document !== "undefined" && document.documentElement.lang) {
    return document.documentElement.lang.toLowerCase().startsWith("zh");
  }
  return typeof navigator === "undefined" ? true : navigator.language.toLowerCase().startsWith("zh");
}

function PluginExtensionDetail({ record, isZh }: { record: PluginRecord; isZh: boolean }) {
  return (
    <div style={{ padding: "20px 24px", color: "var(--color-ink)" }}>
      <h2 style={{ margin: "0 0 8px" }}>{record.manifest.name}</h2>
      <p style={{ margin: "0 0 14px", color: "var(--color-muted)" }}>{record.manifest.description}</p>
      <div style={{ fontSize: "0.85rem", color: "var(--color-muted)", display: "grid", gap: "6px" }}>
        <div>{isZh ? "插件 ID：" : "Plugin ID: "}{record.id}</div>
        <div>{isZh ? "版本：" : "Version: "}v{record.manifest.version}</div>
        <div>{isZh ? "贡献工具：" : "Tools: "}{record.manifest.capabilities.tools.join(", ") || "-"}</div>
        <div>{isZh ? "贡献技能：" : "Skills: "}{record.manifest.capabilities.skills.join(", ") || "-"}</div>
      </div>
    </div>
  );
}

export function pluginsClientPlugin(context: Context): void {
  const registeredViews = new Map<string, () => void>();

  const syncRunningViews = (installed: PluginRecord[]) => {
    const runningMap = new Map<string, PluginRecord>();
    for (const rec of installed) {
      if (rec.status === "running") {
        for (const viewId of rec.manifest.capabilities.views) {
          runningMap.set(viewId, rec);
        }
      }
    }

    // 先注销已停用或卸载的扩展视图，若用户正停留于该视图则退回插件中心。
    for (const [viewId, dispose] of registeredViews.entries()) {
      if (!runningMap.has(viewId)) {
        dispose();
        registeredViews.delete(viewId);
        if (context.workbench.getSnapshot().activeView === viewId) {
          context.workbench.navigate("plugins");
        }
      }
    }

    // 注册新启用的运行中扩展视图。
    for (const [viewId, rec] of runningMap.entries()) {
      if (registeredViews.has(viewId)) continue;
      const dispose = context.workbench.registerView({
        id: viewId,
        title: rec.manifest.name,
        domain: "plugins",
        render: () => <PluginExtensionDetail record={rec} isZh={detectIsZh()} />,
      });
      registeredViews.set(viewId, dispose);
    }
  };

  const isZh = detectIsZh();
  const disposeMainView = context.workbench.registerView({
    id: "plugins",
    title: isZh ? "插件中心" : "Plugins",
    render: () => (
      <PluginsView
        isZh={detectIsZh()}
        onSyncInstalled={syncRunningViews}
        onOpenPluginView={(viewId) => context.workbench.navigate(viewId)}
      />
    ),
  });

  void fetchPluginsState()
    .then((state) => syncRunningViews(state.installed))
    .catch(() => {});

  context.effect(() => () => {
    disposeMainView();
    for (const dispose of registeredViews.values()) dispose();
    registeredViews.clear();
  });
}
pluginsClientPlugin.inject = ["workbench"] as const;

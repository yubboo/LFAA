/**
 * 文件：packages/client/web/src/App.tsx
 * 作用：LFAA Web Client Composition。
 * 负责：按 Identity Gate → Smart Home → AgentWorkbench 顺序组合产品，并注入 Web Host Clients / 本地终端。
 * 不负责：身份持久化、Vite Host、Provider HTTP、PTY 生命周期、App Pack Runtime、业务权限判定、Intent Router。
 * 状态归属：只持有当前展示 Home/Workbench 与一次性 Smart Home draft 的临时导航状态；长期状态由 capability package 拥有。
 * 对外接口：App()。
 * 关联文件：web-entry.tsx、@lfaa/app-shell、@lfaa/client-connection、@lfaa/ui-terminal。
 * 修改注意事项：必须先通过 Identity Gate 才能挂载 Workbench；未实现 App Pack 禁止伪装成可用入口。
 */
import { useState } from "react";
import { AgentWorkbench, LfaaAppHub, LfaaIdentityGate, type AppHubEntry } from "@lfaa/app-shell";
import { webAgentRuntimeHost, webAiSettingsHost, webIdentityHost, webPluginSettingsHost, webWorkspaceSessionHost } from "@lfaa/client-connection";
import { LocalTerminal } from "@lfaa/ui-terminal";

const APP_HUB_ENTRIES: readonly AppHubEntry[] = [
  { id: "lfaa/general", title: "LFAA 通用工作台", description: "进入现有 Chat / Work / Manual 工作台，直接开始任务。", category: "工作台", glyph: "L", available: true, badge: "可用" },
  { id: "lfaa/ai-writing", title: "AI 写作", description: "长篇创作、人物、世界观、章节与文档画布。", category: "AI 创作", glyph: "文", available: false },
  { id: "lfaa/ai-comic", title: "AI 漫剧", description: "剧本、角色、分镜、图像、声音与视频工作流。", category: "AI 创作", glyph: "漫", available: false },
  { id: "lfaa/minecraft", title: "Minecraft", description: "独立游戏服务器创建、配置、运行、备份与运维。", category: "游戏与服务器", glyph: "MC", available: false },
  { id: "lfaa/steam-server", title: "Steam Server", description: "Steam 游戏专用服务器安装、更新与运行管理。", category: "游戏与服务器", glyph: "ST", available: false },
];

export function App() {
  return <LfaaIdentityGate host={webIdentityHost}>{(identity, logout) => <AuthenticatedProduct identity={identity} logout={logout} />}</LfaaIdentityGate>;
}

function AuthenticatedProduct({ identity, logout }: { identity: Awaited<ReturnType<typeof webIdentityHost.me>>; logout: () => Promise<void> }) {
  const [surface, setSurface] = useState<"hub" | "workbench">("hub");
  const [initialComposerDraft, setInitialComposerDraft] = useState("");
  const enterWorkbench = (draft = "") => {
    setInitialComposerDraft(draft);
    setSurface("workbench");
  };
  if (surface === "hub") {
    return (
      <LfaaAppHub
        identity={identity}
        entries={APP_HUB_ENTRIES}
        onEnter={(entry) => { if (entry.available) enterWorkbench(); }}
        onStartIntent={(input) => enterWorkbench(input)}
        onLogout={() => void logout()}
      />
    );
  }
  return (
    <AgentWorkbench
      resources={[]}
      resourceBridgeStatus="connected"
      terminal={<LocalTerminal />}
      aiSettingsHost={webAiSettingsHost}
      pluginSettingsHost={webPluginSettingsHost}
      agentRuntimeHost={webAgentRuntimeHost}
      sessionHost={webWorkspaceSessionHost}
      identitySettingsHost={webIdentityHost}
      initialComposerDraft={initialComposerDraft}
      identity={{ displayName: identity.user.displayName, subtitle: identity.roles.map((role) => role.name).join(" · ") || identity.user.username, permissions: identity.permissions }}
      onOpenAppHub={() => { setInitialComposerDraft(""); setSurface("hub"); }}
      onLogout={() => void logout()}
    />
  );
}

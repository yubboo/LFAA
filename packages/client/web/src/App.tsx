/**
 * 文件：packages/client/web/src/App.tsx
 * 作用：LFAA Web Client Composition。
 * 负责：把 Workbench、Web Host Clients 与本地终端 UI 组合成 Web 产品。
 * 不负责：Vite Host、Provider HTTP、PTY 生命周期、运行时持久化。
 * 状态归属：无独立持久状态；产品状态由各 capability package 拥有。
 * 对外接口：App()。
 * 关联文件：web-entry.tsx、@lfaa/app-shell、@lfaa/client-connection、@lfaa/ui-terminal。
 * 修改注意事项：只做 Client Composition，不把 Host/Provider 业务回流到 React 根。
 */
import { AgentWorkbench } from "@lfaa/app-shell";
import { webAgentRuntimeHost, webAiSettingsHost, webPluginSettingsHost } from "@lfaa/client-connection";
import { LocalTerminal } from "@lfaa/ui-terminal";

export function App() {
  return (
    <AgentWorkbench
      resources={[]}
      resourceBridgeStatus="connected"
      terminal={<LocalTerminal />}
      aiSettingsHost={webAiSettingsHost}
      pluginSettingsHost={webPluginSettingsHost}
      agentRuntimeHost={webAgentRuntimeHost}
    />
  );
}

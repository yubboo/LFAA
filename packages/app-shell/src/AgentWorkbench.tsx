/**
 * 文件：AgentWorkbench.tsx
 * 作用：LFAA Workbench Composition Root。
 * 负责：只创建各模块 Controller，并通过模块公共入口完成父子装配。
 * 不负责：Left/Center/Right/Terminal DOM、AI/Plugin ViewModel 映射、Agent Run 事件细节、Overlay DOM、区域 CSS。
 * 状态归属：Theme/Chrome/Overlay→workbench/shell；Settings→workbench/settings；Chat/Work Run→@lfaa/workspace shared session；区域私有状态→各自模块。
 * 对外接口：AgentWorkbench(props)。
 * 关联文件：workbench/shell、workbench/left、workbench/center、workbench/right、workbench/terminal、workbench/settings、@lfaa/workspace。
 * 修改注意事项：禁止把区域实现重新堆回本文件；所有模块只从各目录 index.ts 公共入口导入。
 */
import type { AgentWorkbenchProps } from "./workbench.types";
import { LeftSidebarRegion } from "./workbench/left";
import { CenterWorkspaceRegion } from "./workbench/center";
import { RightSidebarRegion } from "./workbench/right";
import { BottomTerminalRegion } from "./workbench/terminal";
import {
  WorkbenchOverlays,
  WorkbenchRoot,
  WorkbenchShell,
  useWorkbenchChromeController,
  useWorkbenchOverlayController,
  useWorkbenchShellShortcuts,
  useWorkbenchThemeController,
} from "./workbench/shell";
import {
  SettingsSurface,
  useAiSettingsController,
  usePluginSettingsController,
  useSettingsSurfaceController,
} from "./workbench/settings";
import { useWorkspaceSessionController } from "@lfaa/workspace";
import "./agent-workbench.css";

export function AgentWorkbench(props:AgentWorkbenchProps){
  const theme=useWorkbenchThemeController();
  const chrome=useWorkbenchChromeController();
  const overlays=useWorkbenchOverlayController();
  const settingsSurface=useSettingsSurfaceController();
  const ai=useAiSettingsController(props.aiSettingsHost);
  const plugins=usePluginSettingsController(props.pluginSettingsHost);
  const session=useWorkspaceSessionController({runtimeHost:props.agentRuntimeHost,workspaceId:props.workspaceId,activeModelBinding:ai.activeModelBinding});

  useWorkbenchShellShortcuts({
    onEscape:overlays.closeMenus,
    onOpenSettings:()=>settingsSurface.openSettings("general"),
    onToggleLeft:chrome.toggleLeft,
    onToggleRight:chrome.toggleRight,
    onToggleTerminal:chrome.toggleTerminal,
  });

  const left=(
    <LeftSidebarRegion
      resolvedTheme={theme.resolvedTheme}
      themePreference={theme.themePreference}
      workspaceMode={session.workspaceMode}
      onWorkspaceModeChange={session.setWorkspaceMode}
      onOpenProfile={overlays.openProfile}
      onOpenThemeMenu={overlays.openThemeMenu}
      onRequestUpdate={overlays.requestUpdate}
    />
  );
  const center=(
    <CenterWorkspaceRegion
      layoutMode={chrome.layoutMode}
      leftCollapsed={chrome.chrome.leftCollapsed}
      rightCollapsed={chrome.chrome.rightCollapsed}
      terminalOpen={chrome.chrome.terminalOpen}
      workspaceMode={session.workspaceMode}
      permissionProfileId={session.permissionProfileId}
      modelLabel={ai.modelLabel}
      quickModels={ai.quickModels}
      activeReasoning={ai.activeReasoning}
      runtimeConnected={session.runtimeConnected}
      chatMessages={session.chatMessages}
      workspaceId={props.workspaceId}
      lastRunInput={session.lastRunInput}
      onPermissionProfileChange={session.setPermissionProfileId}
      onSubmitTask={session.startAgentRun}
      onQuickSelectModel={ai.quickSelectModel}
      onQuickUpdateModelSetting={ai.quickUpdateModelSetting}
      onOpenAiSettings={()=>settingsSurface.openSettings("ai")}
      onToggleLeft={chrome.toggleLeft}
      onToggleRight={chrome.toggleRight}
      onToggleTerminal={chrome.toggleTerminal}
      onLeftHoverEnter={chrome.openLeftPreview}
      onLeftHoverLeave={()=>chrome.closeLeftPreview(120)}
    />
  );
  const right=(
    <RightSidebarRegion
      {...(props.resources ? { resources: props.resources } : {})}
      {...(props.resourceBridgeStatus ? { resourceBridgeStatus: props.resourceBridgeStatus } : {})}
      layoutMode={chrome.layoutMode}
      terminalOpen={chrome.chrome.terminalOpen}
      rightCollapsed={chrome.chrome.rightCollapsed}
      onToggleTerminal={chrome.toggleTerminal}
      onToggleRight={chrome.toggleRight}
    />
  );
  const bottom=<BottomTerminalRegion terminal={props.terminal} onClose={chrome.closeTerminal}/>;
  const overlayViews=(
    <WorkbenchOverlays
      controller={overlays}
      layoutMode={chrome.layoutMode}
      resolvedTheme={theme.resolvedTheme}
      themePreference={theme.themePreference}
      onThemePreferenceChange={theme.setThemePreference}
      onOpenSettings={()=>settingsSurface.openSettings("general")}
    />
  );

  return (
    <WorkbenchRoot resolvedTheme={theme.resolvedTheme} themePreference={theme.themePreference} layoutMode={chrome.layoutMode}>
      <WorkbenchShell chrome={chrome} suspended={settingsSurface.surface==="settings"} left={left} center={center} right={right} bottom={bottom} overlays={overlayViews}/>
      {settingsSurface.surface==="settings"?<SettingsSurface activeSection={settingsSurface.settingsSection} onSectionChange={settingsSurface.setSettingsSection} onClose={settingsSurface.closeSettings} leftPaneWidth={chrome.leftPaneWidth} onLeftPaneWidthChange={chrome.setLeftPaneWidth} themePreference={theme.themePreference} onThemePreferenceChange={theme.setThemePreference} ai={ai} plugins={plugins}/>:null}
    </WorkbenchRoot>
  );
}

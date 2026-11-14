/**
 * 文件：workspace-lazy-modules.ts
 * 功能：集中声明工作区用到的懒加载 UI 模块。
 * 作用：延续 Web Client 的按需加载边界，避免工作区壳层预载未使用的领域组件。
 * 关联文件：../../ApplicationWorkspace.tsx、./ApplicationCenterWorkspace.tsx、./ApplicationContextPanel.tsx。
 */
import { lazy } from "react";
import { loadClientModule } from "lfaa-client-modules/src/client/index.js";
export { ApplicationContentLoading } from "./ApplicationContentLoading.js";

// 延续能力包运行时加载边界，工作区壳层不预加载未使用的领域模块。
export const AiWorkChat = lazy(() => loadClientModule<typeof import("lfaa-client-ui-chat/src/AiWorkChat.js")>("lfaa-client-ui-chat/src/AiWorkChat.js").then((module) => ({ default: module.AiWorkChat })));
export const AiWorkSideChat = lazy(() => loadClientModule<typeof import("lfaa-client-ui-chat/src/AiWorkSideChat.js")>("lfaa-client-ui-chat/src/AiWorkSideChat.js").then((module) => ({ default: module.AiWorkSideChat })));
export const CanvasWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-workspace/src/CanvasWorkspace.js")>("lfaa-client-ui-workspace/src/CanvasWorkspace.js").then(module => ({ default: module.CanvasWorkspace })));
export const MinecraftWorkflowCanvas = lazy(() => loadClientModule<typeof import("lfaa-client-ui-minecraft/src/MinecraftWorkflowCanvas.js")>("lfaa-client-ui-minecraft/src/MinecraftWorkflowCanvas.js").then(module => ({ default: module.MinecraftWorkflowCanvas })));
export const ApplicationWorkflowCanvas = lazy(() => loadClientModule<typeof import("lfaa-client-ui-workflow/src/ApplicationWorkflowCanvas.js")>("lfaa-client-ui-workflow/src/ApplicationWorkflowCanvas.js").then(module => ({ default: module.ApplicationWorkflowCanvas })));
export const BrowserPanel = lazy(() => loadClientModule<typeof import("lfaa-client-ui-sidebar-browser/src/BrowserPanel.js")>("lfaa-client-ui-sidebar-browser/src/BrowserPanel.js").then(module => ({ default: module.BrowserPanel })));
export const GitChangeSummary = lazy(() => import("../../GitChangeSummary.js").then((module) => ({ default: module.GitChangeSummary })));
export const AgentAssetLibrary = lazy(() => loadClientModule<typeof import("lfaa-client-ui-deliverables/src/AgentAssetLibrary.js")>("lfaa-client-ui-deliverables/src/AgentAssetLibrary.js").then(module => ({ default: module.AgentAssetLibrary })));
export const MinecraftWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-minecraft/src/MinecraftWorkspace.js")>("lfaa-client-ui-minecraft/src/MinecraftWorkspace.js").then((module) => ({ default: module.MinecraftWorkspace })));
export const MinecraftInstanceRuntimeContextPanel = lazy(() => loadClientModule<typeof import("lfaa-client-ui-minecraft/src/MinecraftWorkspace.js")>("lfaa-client-ui-minecraft/src/MinecraftWorkspace.js").then((module) => ({ default: module.MinecraftInstanceRuntimeContextPanel })));
export const MinecraftInstanceServerInfoContextPanel = lazy(() => loadClientModule<typeof import("lfaa-client-ui-minecraft/src/MinecraftWorkspace.js")>("lfaa-client-ui-minecraft/src/MinecraftWorkspace.js").then((module) => ({ default: module.MinecraftInstanceServerInfoContextPanel })));
export const ConnectivityWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-connectivity/src/ConnectivityWorkspace.js")>("lfaa-client-ui-connectivity/src/ConnectivityWorkspace.js").then((module) => ({ default: module.ConnectivityWorkspace })));
export const WritingBookInfo = lazy(() => loadClientModule<typeof import("lfaa-client-ui-writing/src/normal/WritingBookInfo.js")>("lfaa-client-ui-writing/src/normal/WritingBookInfo.js").then((module) => ({ default: module.WritingBookInfo })));
export const WritingWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-writing/src/normal/WritingWorkspace.js")>("lfaa-client-ui-writing/src/normal/WritingWorkspace.js").then((module) => ({ default: module.WritingWorkspace })));
export const AiVideoCanvasWorkspace = lazy(() => import("../../AiVideoCanvasWorkspace.js").then((module) => ({ default: module.AiVideoCanvasWorkspace })));

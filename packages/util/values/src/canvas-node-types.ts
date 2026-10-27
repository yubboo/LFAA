/**
 * 功能：声明系统画布节点按 App 暴露的能力目录。
 * 作用：让客户端节点菜单和 Agent 画布工具共用同一份 App 范围合同。
 */
import type { ApplicationId } from "./application-id.js";

export const CANVAS_NODE_KINDS_BY_APPLICATION: Readonly<Record<ApplicationId, readonly string[]>> = {
  workspace: ["text", "note", "image", "video", "audio", "generation", "asset"],
  minecraft: ["text", "note"],
  connectivity: ["text", "note"],
  writing: ["text", "note", "script"],
  steamcmd: ["text", "note"],
  aivideo: ["text", "note", "image", "video", "audio", "generation", "subject", "timeline", "director-toolbox", "director-desk", "script", "asset"]
};

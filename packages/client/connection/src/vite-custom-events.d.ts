/**
 * 文件：vite-custom-events.d.ts
 * 作用：声明 Web Client Connection 使用的 Agent Runtime Vite 自定义事件类型。
 * 负责：把 lfaa:agent-runtime-event 绑定到公共 AgentRuntimeEvent 契约。
 * 不负责：建立 HMR 连接、启动 Run、管理终端事件或实现 Agent Runtime。
 * 状态归属：纯类型契约，无运行时状态。
 * 对外接口：扩展 vite/types/customEvent 的 CustomEventMap。
 * 关联文件：agent-runtime-client.ts、packages/api/agent-controller/src/agent-runtime-bridge.ts。
 * 修改注意事项：事件名或 payload 改动必须同步 Runtime Controller 与 Browser Client。
 */
import "vite/types/customEvent";
import type { AgentRuntimeEvent } from "@lfaa/agent-runtime";

declare module "vite/types/customEvent" {
  interface CustomEventMap {
    "lfaa:agent-runtime-event": AgentRuntimeEvent;
  }
}

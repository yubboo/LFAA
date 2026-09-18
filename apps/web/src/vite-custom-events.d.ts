/**
 * 文件：vite-custom-events.d.ts
 * 作用：为 LFAA Web 开发终端使用的 Vite 自定义 HMR 事件补充 TypeScript 类型。
 * 负责：声明浏览器端与 Vite 本地终端桥之间的消息结构。
 * 不负责：建立连接、启动 PTY、处理终端 UI。
 * 状态归属：类型契约，无运行时状态。
 * 对外接口：扩展 vite/types/customEvent 的 CustomEventMap。
 * 关联文件：LocalTerminal.tsx、apps/web/vite.config.ts。
 * 修改注意事项：事件名或 payload 改动必须两端同时修改，否则运行期消息会失配。
 */
import "vite/types/customEvent";

declare module "vite/types/customEvent" {
  interface CustomEventMap {
    "lfaa:terminal:create": { clientId: string; cols: number; rows: number };
    "lfaa:terminal:input": { clientId: string; data: string };
    "lfaa:terminal:resize": { clientId: string; cols: number; rows: number };
    "lfaa:terminal:dispose": { clientId: string };
    "lfaa:terminal:data": { clientId: string; data: string };
    "lfaa:terminal:ready": { clientId: string; shell: string };
    "lfaa:terminal:exit": { clientId: string; exitCode: number };
    "lfaa:terminal:error": { clientId: string; message: string };
  }
}

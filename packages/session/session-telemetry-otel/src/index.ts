/**
 * 文件：index.ts
 * 功能：会话遥测的 OpenTelemetry 导出适配 seam。
 * 待集成：pnpm store 中尚无 @opentelemetry/sdk-metrics 等 OTEL 依赖；本包不强行 import 缺失包，
 *        而是提供导出器工厂——在 OTEL SDK 安装并配置 endpoint 后，把 SessionTelemetry 计数转成 OTEL 仪器。
 *        当前返回一个空操作导出器，保证类型与装配完整、运行不报错。
 * 边界：不采集正文/密钥；真正上报地址由用户设置提供，不写死。
 * 关联文件：session-telemetry。
 */
import type { Context } from "@deepseek-ai/cordis";

/** OTEL 导出器最小形状（待 SDK 落地后填充真实实现）。 */
export interface OtelSessionExporter {
  readonly enabled: boolean;
  /** 刷新一次（当前为 no-op）。 */
  flush(): Promise<void>;
}

/** 构造导出器；SDK 未安装时返回禁用的空操作实例。 */
export function createOtelSessionExporter(): OtelSessionExporter {
  return { enabled: false, flush: async () => {} };
}

export const name = "lfaaSessionTelemetryOtel";
export function apply(ctx: Context): void {
  ctx.provide(name, createOtelSessionExporter());
}

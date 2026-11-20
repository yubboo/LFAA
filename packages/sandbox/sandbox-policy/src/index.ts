// @lfaa/sandbox-policy：逐次沙箱策略。按工具指定本次执行使用的沙箱模式，缺省沿用调用方。
import type { Context, Plugin } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import type { SandboxModeResolver } from "@lfaa/tools";

/** 可指定的沙箱模式，与 ToolExecutionContext.sandboxMode 一致。 */
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

/** 策略配置：全局默认 + 按工具覆盖 + 只对部分工具生效。 */
export interface SandboxPolicyConfig {
  /** 所有（受约束的）工具默认使用的模式；未配置则沿用调用方。 */
  mode?: SandboxMode;
  /** 按工具名覆盖。 */
  byTool?: Record<string, SandboxMode>;
  /** 仅对这些工具生效；为空表示全部。 */
  onlyTools?: string[];
}

/** 解析一次调用的沙箱模式；返回 undefined 表示沿用调用方。 */
export function resolveSandboxMode(
  name: string,
  config: SandboxPolicyConfig = {},
): SandboxMode | undefined {
  if (config.onlyTools && config.onlyTools.length > 0 && !config.onlyTools.includes(name)) return undefined;
  const override = config.byTool?.[name];
  if (override) return override;
  return config.mode;
}

/** 把配置变成可注册的策略函数。 */
export function createSandboxPolicy(config: SandboxPolicyConfig = {}): SandboxModeResolver {
  return (name) => resolveSandboxMode(name, config);
}

/** 安装策略；返回注销函数。未装配 sandbox 服务时本策略无效果（工具层本就不做限制）。 */
export function installSandboxPolicy(ctx: Context, config: SandboxPolicyConfig = {}): () => void {
  return ctx.tools.setSandboxResolver(createSandboxPolicy(config));
}

const sandboxPolicyCore: Plugin.Object<SandboxPolicyConfig> = {
  name: "lfaa-sandbox-policy",
  inject: ["tools"],
  apply(ctx, config) {
    installSandboxPolicy(ctx, config ?? {});
  },
};

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default sandboxPolicyCore;
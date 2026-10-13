/**
 * 功能：shell 托管环境变量注册表（LFAA_* 前缀）。
 * 作用：收集各插件声明的可信运行时事实（工作目录/平台/主机等），统一加 LFAA_ 前缀后注入子进程环境，
 *       使模型在 shell 命令中可用 $LFAA_* 读取当前 Harness 环境，而无需模型猜测路径。
 * 关联文件：shell/types.ts（LFAA_ENV_PREFIX）、pwsh-local/bash-local（消费 lfaaEnv）。
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-shell-env。
 */
import os from "node:os";
import type { Context } from "@deepseek-ai/cordis";
import { LFAA_ENV_PREFIX } from "lfaa-shell";

/** 一个托管环境变量提供方：返回「短键 → 字符串值」，注册表统一加 LFAA_ 前缀。 */
export interface ShellEnvProvider {
  (ctx: Context): Record<string, string>;
}

/** 已注册提供方与收集到的值的不可变快照。 */
export interface ShellEnvSnapshot {
  collected: Record<string, string>;
}

/** 暴露给插件的 shellEnv 服务。 */
export interface ShellEnvService {
  /** 注册一个提供方；插件卸载时自动注销。 */
  register(provider: ShellEnvProvider): void;
  /** 运行全部已注册提供方并合并为 LFAA_* 环境映射（每次收集实时求值）。 */
  collect(): Record<string, string>;
}

/** 校验短键：字母/数字/下划线，且不与前缀冲突。 */
function isValidKey(key: string): boolean {
  return /^[A-Z0-9_]+$/u.test(key) && !key.startsWith("LFAA_");
}

/** 合并多个提供方结果；冲突时后注册者覆盖，但记录到警告。 */
function collectFrom(providers: readonly ShellEnvProvider[], ctx: Context): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const provider of providers) {
    let provided: Record<string, string>;
    try {
      provided = provider(ctx) ?? {};
    } catch (error) {
      // 单个提供方失败不应阻断整条命令；记录后跳过。
      ctx.logger?.warn?.(`[lfaa-shell-env] provider failed: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    for (const [shortKey, value] of Object.entries(provided)) {
      if (!isValidKey(shortKey) || typeof value !== "string") continue;
      merged[`${LFAA_ENV_PREFIX}${shortKey}`] = value;
    }
  }
  return merged;
}

/** 内置默认事实：宿主工作目录/平台/主机/Node 版本（这些是安全、稳定的环境事实）。 */
function defaultProvider(): ShellEnvProvider {
  return () => ({
    CWD: process.cwd(),
    PLATFORM: process.platform,
    HOSTNAME: os.hostname(),
    NODE_VERSION: process.version,
  });
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    shellEnv: ShellEnvService;
  }
}

export const name = "lfaa-shell-env";

export function apply(ctx: Context): void {
  const providers: ShellEnvProvider[] = [defaultProvider()];
  ctx.provide(name, {
    register(provider: ShellEnvProvider): void {
      ctx.effect(() => {
        providers.push(provider);
        return () => {
          const index = providers.indexOf(provider);
          if (index >= 0) providers.splice(index, 1);
        };
      }, "lfaa-shell-env:provider");
    },
    collect(): Record<string, string> {
      return Object.freeze(collectFrom(providers, ctx));
    },
  } satisfies ShellEnvService);
}

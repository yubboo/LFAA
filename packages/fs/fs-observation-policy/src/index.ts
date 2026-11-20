// @lfaa/fs-observation-policy：写前必读。写文件/改文件前，同一会话必须先读过该文件，避免盲改。
import { stat } from "node:fs/promises";
import type { Context, Plugin } from "@deepseek-ai/cordis";
import { resolveSafeWorkspacePath } from "@lfaa/fs";
import "@lfaa/tools";

/** 默认需要先读的工具与记录读取的工具。 */
export const OBSERVATION_DEFAULTS = {
  guardedTools: ["write_file", "edit_file"],
  observeTools: ["read_file"],
} as const;

/** 观察策略配置：工具名可替换，便于测试或自定义工具集。 */
export interface FsObservationConfig {
  guardedTools?: string[];
  observeTools?: string[];
}

/** 按会话记录「已读取过哪些文件」。 */
export class ObservationTracker {
  private readonly seen = new Map<string, Set<string>>();

  markRead(sessionId: string, path: string): void {
    const set = this.seen.get(sessionId) ?? new Set<string>();
    set.add(path);
    this.seen.set(sessionId, set);
  }

  hasRead(sessionId: string, path: string): boolean {
    return this.seen.get(sessionId)?.has(path) ?? false;
  }

  listRead(sessionId: string): string[] {
    return [...(this.seen.get(sessionId) ?? [])];
  }

  clearSession(sessionId: string): void {
    this.seen.delete(sessionId);
  }

  clear(): void {
    this.seen.clear();
  }
}

/** 拦截文案：给出具体文件与下一步动作，避免模型反复试同一调用。 */
export function observationHint(toolName: string, rawPath: string): string {
  return `工具 ${toolName} 被拦截：目标文件 ${rawPath} 在本会话尚未读取。请先用 read_file 查看现有内容，再执行修改。`;
}

/** 尽力把工具参数里的路径归一到真实路径；越界或非法时返回 undefined，交给工具自身拦截。 */
async function resolveTarget(
  rawPath: string,
  context: { workspaceRoots: string[]; allowOutsideWorkspace?: boolean | undefined },
): Promise<string | undefined> {
  try {
    const resolved = await resolveSafeWorkspacePath(rawPath, context.workspaceRoots, {
      ...(context.allowOutsideWorkspace ? { allowOutsideWorkspace: true } : {}),
    });
    return resolved.path;
  } catch {
    return undefined;
  }
}

/** 安装写前必读策略；返回追踪器便于测试与诊断。 */
export function installFsObservationPolicy(ctx: Context, config: FsObservationConfig = {}): ObservationTracker {
  const guarded = new Set(config.guardedTools ?? OBSERVATION_DEFAULTS.guardedTools);
  const observed = new Set(config.observeTools ?? OBSERVATION_DEFAULTS.observeTools);
  const tracker = new ObservationTracker();
  ctx.effect(() => () => tracker.clear());

  ctx.effect(() => ctx.tools.useToolMiddleware({
    id: "@lfaa/fs-observation-policy",
    aroundExecute: async (next, info) => {
      if (!guarded.has(info.name)) return next();
      const rawPath = typeof info.args.path === "string" ? info.args.path : "";
      if (!rawPath.trim()) return next();
      const target = await resolveTarget(rawPath, info.context);
      if (!target) return next();
      const exists = await stat(target).then(() => true, () => false);
      // 新建文件无需先读；已存在文件要求本会话读过。
      if (!exists) {
        tracker.markRead(info.context.sessionId, target);
        return next();
      }
      if (tracker.hasRead(info.context.sessionId, target)) return next();
      return {
        ok: false,
        output: observationHint(info.name, rawPath),
        summary: "写前必读拦截",
        metadata: { observationBlocked: true, tool: info.name, path: target },
      };
    },
    afterExecute: (result, info) => {
      const rawPath = typeof info.args.path === "string" ? info.args.path : "";
      if (!rawPath.trim()) return result;
      const applicable = observed.has(info.name) || (guarded.has(info.name) && result.ok);
      if (!applicable) return result;
      return resolveTarget(rawPath, info.context).then((target) => {
        if (target) tracker.markRead(info.context.sessionId, target);
        return result;
      });
    },
  }));

  return tracker;
}

const fsObservationCore: Plugin.Object<FsObservationConfig> = {
  name: "lfaa-fs-observation-policy",
  inject: ["tools"],
  apply(ctx, config) {
    installFsObservationPolicy(ctx, config ?? {});
  },
};

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default fsObservationCore;
// 为智能体提供只读 Git 检查工具（git_status / git_diff），免去调用 exec 审批即可直接感知分支与改动。
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveSafeWorkspacePath, resolveSafeWorkspaceRoot } from "@lfaa/fs";
import type { AgentToolDefinition } from "./types";

const execFileAsync = promisify(execFile);
const STRIPPED_GIT_ENV_KEYS = ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_PREFIX"] as const;
const MAX_DIFF_CHARS = 12_000;

async function resolveGitCwd(workspaceRoots: string[], rawCwd: unknown): Promise<string> {
  if (typeof rawCwd === "string" && rawCwd.trim()) {
    const resolved = await resolveSafeWorkspacePath(rawCwd.trim(), workspaceRoots);
    return resolved.path;
  }
  return resolveSafeWorkspaceRoot(workspaceRoots);
}

async function runReadOnlyGit(cwd: string, args: string[], signal?: AbortSignal): Promise<string> {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" };
  for (const key of STRIPPED_GIT_ENV_KEYS) delete env[key];
  const { stdout } = await execFileAsync("git", ["-c", "core.quotepath=false", ...args], {
    cwd,
    timeout: 10_000,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
    encoding: "utf8",
    env,
    ...(signal ? { signal } : {}),
  });
  return String(stdout ?? "");
}

/** 创建只读 Git 工具集，供主智能体与调研/审查子智能体免审批使用。 */
export function createGitReadTools(): AgentToolDefinition[] {
  return [
    {
      name: "git_status",
      title: "查看 Git 状态",
      description: "查看当前工作区的 Git 分支、暂存区与未暂存文件变更摘要（只读，无需命令审批）。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          cwd: { type: "string", description: "可选：相对工作区的子目录路径" },
        },
      },
      execute: async (args, ctx) => {
        const cwd = await resolveGitCwd(ctx.workspaceRoots, args.cwd);
        try {
          const out = await runReadOnlyGit(cwd, ["status", "--short", "--branch"], ctx.signal);
          const trimmed = out.trim();
          const lines = trimmed ? trimmed.split(/\r?\n/u) : [];
          const changed = Math.max(0, lines.length - 1);
          return {
            ok: true,
            output: trimmed || "(工作区干净)",
            summary: changed > 0 ? `Git 变更 ${changed} 项` : "工作区干净",
          };
        } catch (error) {
          return {
            ok: false,
            output: error instanceof Error ? error.message : String(error),
            summary: "非 Git 仓库或读取失败",
          };
        }
      },
    },
    {
      name: "git_diff",
      title: "查看 Git 差异",
      description: "查看当前工作区或暂存区的 Git diff（只读，无需命令审批）；大仓库建议传 filePath 或 statOnly=true。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "可选：只看单个文件的差异（相对路径）" },
          staged: { type: "boolean", description: "是否查看已暂存区（--cached），默认 false" },
          statOnly: { type: "boolean", description: "是否只返回 --stat 统计摘要，默认 false" },
          cwd: { type: "string", description: "可选：相对工作区的子目录路径" },
        },
      },
      execute: async (args, ctx) => {
        const cwd = await resolveGitCwd(ctx.workspaceRoots, args.cwd);
        const gitArgs = ["diff"];
        if (args.staged === true) gitArgs.push("--cached");
        if (args.statOnly === true) gitArgs.push("--stat");
        const filePath = typeof args.filePath === "string" ? args.filePath.trim() : "";
        if (filePath && !filePath.startsWith("-")) {
          gitArgs.push("--", filePath);
        }
        try {
          const out = await runReadOnlyGit(cwd, gitArgs, ctx.signal);
          const clipped = out.length > MAX_DIFF_CHARS
            ? `${out.slice(0, MAX_DIFF_CHARS)}\n\n... [差异过长已截断，请传 filePath 或 statOnly=true 查看明细]`
            : out;
          return {
            ok: true,
            output: clipped.trim() || "(无差异)",
            summary: filePath ? `Git diff: ${filePath}` : "Git diff 完成",
          };
        } catch (error) {
          return {
            ok: false,
            output: error instanceof Error ? error.message : String(error),
            summary: "读取 Git diff 失败",
          };
        }
      },
    },
  ];
}

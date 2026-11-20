// 提供内置核心工作区工具集（读文件、列目录、文本搜索、写文件、命令执行）。
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { executeShell, type ShellService } from "@lfaa/shell";
import { appendCommandAudit, findProtectedPathInCommand, normalizeCommandTimeout } from "@lfaa/guard";
import { createPrivatePathFilter, resolveSafeWorkspacePath, resolveSafeWorkspaceRoot } from "@lfaa/fs";
import type { AgentToolDefinition, CommandTimeoutHandler, ToolFileChange } from "./types";
import { IGNORED_DIRS, walkWorkspaceFiles } from "@lfaa/fs";

/** 前台命令超时后的可选兜底（由 Jobs 服务注入，转后台任务继续执行）。 */
export interface BuiltinToolHooks {
  onCommandTimeout?: CommandTimeoutHandler;
}

/** 去掉双方共有的首尾行，限制为本次写入的变更片段。 */
export function captureFileChange(path: string, resolvedPath: string, previous: string | null, next: string): ToolFileChange {
  const beforeLines = previous ? previous.split("\n") : [];
  const afterLines = next ? next.split("\n") : [];
  let start = 0;
  let beforeEnd = beforeLines.length;
  let afterEnd = afterLines.length;
  while (start < beforeEnd && start < afterEnd && beforeLines[start] === afterLines[start]) start += 1;
  while (beforeEnd > start && afterEnd > start && beforeLines[beforeEnd - 1] === afterLines[afterEnd - 1]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }
  const before = beforeLines.slice(start, beforeEnd).join("\n");
  const after = afterLines.slice(start, afterEnd).join("\n");
  const limit = 8000;
  return {
    path,
    resolvedPath,
    operation: previous === null ? "created" : "edited",
    firstLine: start + 1,
    before: before.slice(0, limit),
    after: after.slice(0, limit),
    truncated: before.length > limit || after.length > limit,
  };
}

/** 统计写文件前后的行级新增 / 删除数，供界面展示变更规模。 */
export function countLineDiff(prevText: string, nextText: string): { added: number; removed: number } {
  const nextLines = nextText ? nextText.split(/\r?\n/) : [];
  if (!prevText) {
    return { added: nextLines.length, removed: 0 };
  }
  const prevLines = prevText.split(/\r?\n/);
  const prevCounts = new Map<string, number>();
  for (const line of prevLines) {
    prevCounts.set(line, (prevCounts.get(line) ?? 0) + 1);
  }
  let matched = 0;
  for (const line of nextLines) {
    const count = prevCounts.get(line) ?? 0;
    if (count > 0) {
      matched += 1;
      prevCounts.set(line, count - 1);
    }
  }
  return {
    added: Math.max(0, nextLines.length - matched),
    removed: Math.max(0, prevLines.length - matched),
  };
}

/** 构造默认本地工作区工具，统一通过工具上下文接收路径和权限约束。 */
export function createBuiltinWorkspaceTools(
  executeCommand: ShellService["execute"] = executeShell,
  hooks: BuiltinToolHooks = {},
): AgentToolDefinition[] {
  return [
    {
      name: "list_dir",
      title: "列出目录",
      description: "列出工作区目录中的文件与子目录。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "相对或绝对目录路径，默认为工作区根目录 ." },
        },
      },
      async execute(args, ctx) {
        const rawPath = typeof args.path === "string" ? args.path : ".";
        const { path: targetDir } = await resolveSafeWorkspacePath(rawPath, ctx.workspaceRoots, {
          allowOutsideWorkspace: ctx.allowOutsideWorkspace,
        });
        const entries = await readdir(targetDir, { withFileTypes: true });
        const isPrivate = await createPrivatePathFilter();
        const visible = entries.filter((entry) => !IGNORED_DIRS.has(entry.name) && !isPrivate(join(targetDir, entry.name)));
        const lines = visible
          .slice(0, 120)
          .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
          .map((e) => `${e.isDirectory() ? "[dir] " : "[file]"} ${e.name}`);
        return {
          ok: true,
          output: lines.join("\n") || "(空目录)",
          summary: `列出 ${visible.length} 项内容`,
        };
      },
    },
    {
      name: "read_file",
      title: "读取文件",
      description: "按行范围读取工作区内的文本文件内容。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "目标文件路径" },
          startLine: { type: "number", description: "起始行（从 1 开始，可选）" },
          endLine: { type: "number", description: "结束行（含，可选，单次建议不超过 200 行）" },
        },
        required: ["path"],
      },
      async execute(args, ctx) {
        const rawPath = typeof args.path === "string" ? args.path : "";
        const { path: targetFile } = await resolveSafeWorkspacePath(rawPath, ctx.workspaceRoots, {
          allowOutsideWorkspace: ctx.allowOutsideWorkspace,
        });
        const raw = await readFile(targetFile, "utf8");
        const allLines = raw.split(/\r?\n/u);
        const start = Math.max(1, typeof args.startLine === "number" ? Math.floor(args.startLine) : 1);
        const end = Math.min(allLines.length, typeof args.endLine === "number" ? Math.floor(args.endLine) : start + 199);
        const slice = allLines.slice(start - 1, end).map((line, i) => `${start + i}: ${line}`);
        return {
          ok: true,
          output: slice.join("\n").slice(0, 24000),
          summary: `读取 ${relative(ctx.workspaceRoots[0] ?? "", targetFile) || rawPath} (${start}-${end}/${allLines.length})`,
        };
      },
    },
    {
      name: "search_files",
      title: "搜索文件内容",
      description: "在工作区文本文件中搜索指定关键词并返回命中行。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "检索文本关键词" },
          path: { type: "string", description: "检索起始目录，默认 ." },
        },
        required: ["query"],
      },
      async execute(args, ctx) {
        const query = typeof args.query === "string" ? args.query.trim() : "";
        if (!query) return { ok: false, output: "搜索关键词不能为空。", summary: "缺少关键词" };
        const { path: startDir } = await resolveSafeWorkspacePath(
          typeof args.path === "string" ? args.path : ".",
          ctx.workspaceRoots,
          { allowOutsideWorkspace: ctx.allowOutsideWorkspace },
        );
        const matches: string[] = [];
        const needle = query.toLowerCase();
        // 复用统一遍历器：忽略依赖目录、私有路径与超限文件，避免整树无界读取。
        const files = await walkWorkspaceFiles(startDir, { signal: ctx.signal, maxBytes: 256 * 1024 });
        for (const file of files) {
          if (ctx.signal.aborted || matches.length >= 40) break;
          try {
            const text = await readFile(file.path, "utf8");
            if (text.includes("\u0000")) continue;
            const lines = text.split(/\r?\n/u);
            for (let idx = 0; idx < lines.length; idx += 1) {
              if (lines[idx]!.toLowerCase().includes(needle)) {
                matches.push(`${file.relativePath}:${idx + 1}: ${lines[idx]!.trim().slice(0, 160)}`);
                if (matches.length >= 40) break;
              }
            }
          } catch {
            // 跳过无法读取的文件。
          }
        }
        return {
          ok: true,
          output: matches.join("\n") || `未找到匹配 "${query}" 的内容。`,
          summary: `命中 ${matches.length} 处匹配`,
        };
      },
    },
    {
      name: "write_file",
      title: "写入文件",
      description: "在工作区内创建或覆写文本文件（需人工授权）。",
      permissionLevel: "write",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "目标文件路径" },
          content: { type: "string", description: "完整文件内容" },
        },
        required: ["path", "content"],
      },
      async execute(args, ctx) {
        const rawPath = typeof args.path === "string" ? args.path : "";
        const content = typeof args.content === "string" ? args.content : "";
        const { path: targetFile } = await resolveSafeWorkspacePath(rawPath, ctx.workspaceRoots, {
          allowOutsideWorkspace: ctx.allowOutsideWorkspace,
        });
        const previousContent = await readFile(targetFile, "utf8").catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });
        await mkdir(dirname(targetFile), { recursive: true });
        await writeFile(targetFile, content, { encoding: "utf8", flag: previousContent === null ? "wx" : "w" });
        const diff = countLineDiff(previousContent ?? "", content);
        return {
          ok: true,
          output: `已写入文件：${targetFile}（${content.length} 字符）`,
          summary: `已写入 ${rawPath}`,
          metadata: { filePath: rawPath, added: diff.added, removed: diff.removed },
          fileChange: captureFileChange(rawPath, targetFile, previousContent, content),
        };
      },
    },
    {
      name: "run_command",
      title: "执行终端命令",
      description: "在工作区根目录执行终端命令（需人工授权）。默认超时 10 分钟，可用 timeoutMs（最大 30 分钟）延长；服务器、监听类命令请改用 start_background_task。命令以当前用户权限运行，禁止读取 ~/.lfaa 下的配置、凭据与会话文件（会被拦截并审计）。",
      permissionLevel: "exec",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "待执行命令" },
          timeoutMs: { type: "number", description: "可选时限毫秒数，范围 5000–1800000，缺省 600000" },
        },
        required: ["command"],
      },
      async execute(args, ctx) {
        const command = typeof args.command === "string" ? args.command.trim() : "";
        if (!command) return { ok: false, output: "命令不能为空。", summary: "命令为空" };
        const cwd = await resolveSafeWorkspaceRoot(ctx.workspaceRoots, {
          allowOutsideWorkspace: ctx.allowOutsideWorkspace,
        });
        const protectedTarget = findProtectedPathInCommand(command);
        if (protectedTarget) {
          await appendCommandAudit({
            at: Date.now(), sessionId: ctx.sessionId, runId: ctx.runId, cwd, command, ok: false,
          });
          return {
            ok: false,
            output: `命令引用了应用私有${protectedTarget}，已拦截。请使用设置界面或对应工具，不要在终端读取应用私有文件。`,
            summary: "命令已安全拦截",
          };
        }
        const timeoutMs = normalizeCommandTimeout(args.timeoutMs);
        const startedAt = Date.now();
        const result = await executeCommand({
          command,
          cwd,
          signal: ctx.signal,
          ...(ctx.onCommandOutput ? { onOutput: ctx.onCommandOutput } : {}),
          ...(timeoutMs === undefined ? {} : { timeoutMs }),
        });
        // 无论成功、超时还是转后台，都留一条本地审计记录，便于事后追溯。
        await appendCommandAudit({
          at: Date.now(), sessionId: ctx.sessionId, runId: ctx.runId, cwd, command,
          ok: result.ok,
          ...(result.exitCode === undefined ? {} : { exitCode: result.exitCode }),
          ...(result.timedOut ? { timedOut: true } : {}),
        });
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        if (result.timedOut) {
          // 前台时限只负责拦住“无限等待”，长构建交给后台任务继续跑，避免整轮任务被判定失败。
          const fallback = hooks.onCommandTimeout && ctx.allowsTool?.("start_background_task") !== false
            ? await hooks.onCommandTimeout({
              command,
              cwd,
              sessionId: ctx.sessionId,
              runId: ctx.runId,
            }).catch(() => null)
            : null;
          if (fallback) {
            return {
              ok: false,
              output: `命令在前台运行 ${elapsedSeconds} 秒后达到时限被终止，已自动转入后台任务继续执行。\n后台任务：${fallback.taskId}（${fallback.title}）\n请用 get_background_task 查看状态与输出，需要更长时限时也可下次直接传 timeoutMs。\n\n前台末尾输出：\n${result.output}`,
              summary: `命令超时，已转后台任务 ${fallback.taskId}`,
              metadata: { backgroundTaskId: fallback.taskId },
            };
          }
          return {
            ok: false,
            output: `命令在前台运行 ${elapsedSeconds} 秒后达到时限被终止。构建、安装等长命令请传 timeoutMs（最大 30 分钟），服务器或监听类命令请用 start_background_task。\n\n${result.output}`,
            summary: "命令执行超时",
          };
        }
        return {
          ok: result.ok,
          output: result.output || "(命令执行完成，无输出)",
          summary: result.ok ? "命令执行成功" : result.exitCode === undefined ? "命令执行中断" : `命令执行失败，退出码 ${result.exitCode}`,
          ...(result.exitCode === undefined ? {} : { metadata: { exitCode: result.exitCode } }),
        };
      },
    },
  ];
}

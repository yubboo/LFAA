// 提供唯一命中校验的局部编辑工具：命中多处时拒绝执行，避免一次替换误改整份文件。
import { readFile, writeFile } from "node:fs/promises";
import { captureFileChange, countLineDiff } from "./builtin-tools";
import { resolveSafeWorkspacePath } from "@lfaa/fs";
import type { AgentToolDefinition } from "./types";

/** 找出 target 的全部出现位置，用于判断是否唯一命中。 */
function findOccurrences(text: string, target: string): number[] {
  const positions: number[] = [];
  let from = 0;
  while (from <= text.length - target.length) {
    const index = text.indexOf(target, from);
    if (index < 0) break;
    positions.push(index);
    from = index + target.length;
  }
  return positions;
}

/** 把字符偏移换算成 1 起始行号，供歧义提示使用。 */
function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

/** 构造唯一命中的局部编辑工具。 */
export function createEditTools(): AgentToolDefinition[] {
  return [
    {
      name: "edit_file",
      title: "局部编辑文件",
      description: "把文件中唯一命中的旧片段替换为新片段（需人工授权）。target 必须唯一命中；命中多处时请补充上下文行，或用 replaceAll 显式替换全部。",
      permissionLevel: "write",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "目标文件路径" },
          target: { type: "string", description: "精确匹配的现有文本，建议包含前后几行以保证唯一" },
          replacement: { type: "string", description: "替换后的新文本" },
          replaceAll: { type: "boolean", description: "为 true 时替换全部命中（默认 false，要求唯一命中）" },
        },
        required: ["path", "target", "replacement"],
      },
      async execute(args, ctx) {
        const rawPath = typeof args.path === "string" ? args.path : "";
        const target = typeof args.target === "string" ? args.target : "";
        const replacement = typeof args.replacement === "string" ? args.replacement : "";
        const replaceAll = args.replaceAll === true;
        if (!target) return { ok: false, output: "target 不能为空。", summary: "参数无效" };
        const { path: targetFile } = await resolveSafeWorkspacePath(rawPath, ctx.workspaceRoots, {
          allowOutsideWorkspace: ctx.allowOutsideWorkspace,
        });
        const existing = await readFile(targetFile, "utf8");
        const positions = findOccurrences(existing, target);
        if (positions.length === 0) {
          return {
            ok: false,
            output: `文件 ${rawPath} 中未找到匹配 target 片段。请先用 read_file 或 grep 确认目标文本（含缩进与换行）。`,
            summary: "未命中替换文本",
          };
        }
        if (positions.length > 1 && !replaceAll) {
          const lines = positions.slice(0, 8).map((offset) => `第 ${lineOf(existing, offset)} 行`).join("、");
          return {
            ok: false,
            output: `target 在 ${rawPath} 中命中 ${positions.length} 处（${lines}），为避免误改已取消。请在 target 中补充上下文使其唯一，或显式传 replaceAll:true 替换全部。`,
            summary: `命中 ${positions.length} 处，需要唯一匹配`,
          };
        }
        const next = replaceAll
          ? existing.split(target).join(replacement)
          : `${existing.slice(0, positions[0]!)}${replacement}${existing.slice(positions[0]! + target.length)}`;
        if (next === existing) {
          return { ok: true, output: `替换前后内容相同，未改动 ${rawPath}。`, summary: "内容未变化" };
        }
        await writeFile(targetFile, next, "utf8");
        const diff = countLineDiff(existing, next);
        return {
          ok: true,
          output: `已更新文件：${rawPath}（替换 ${positions.length} 处）`,
          summary: `已编辑 ${rawPath}`,
          metadata: { filePath: rawPath, added: diff.added, removed: diff.removed, replacements: positions.length },
          fileChange: captureFileChange(rawPath, targetFile, existing, next),
        };
      },
    },
  ];
}

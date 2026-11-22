// Git 提交与 PR 草稿生成：根据仓库快照与用户偏好拼出可编辑的提交消息、PR 标题与正文。
// 从 git-service 拆出：纯函数、无 IO，便于单独调整文案规则。
import { basename } from "node:path";
import type { GitCodingSettings } from "@lfaa/settings";
import type { GitStatusSnapshot } from "./git-service";

/** 生成提交消息草稿：优先描述已暂存文件，没有暂存时退回全部变更。 */
export function buildCommitDraft(status: GitStatusSnapshot, gitSettings: GitCodingSettings): {
  message: string;
  appliedInstructions: string;
} {
  const staged = status.files.filter((f) => f.staged);
  const targetFiles = staged.length > 0 ? staged : status.files;
  if (targetFiles.length === 0) {
    return {
      message: "chore: sync workspace state",
      appliedInstructions: gitSettings.commitInstructions.trim(),
    };
  }
  const hasAdded = targetFiles.some((f) => f.untracked || f.indexStatus === "A");
  const hasDocs = targetFiles.every((f) => f.path.endsWith(".md") || f.path.startsWith("docs/"));
  const prefix = hasDocs ? "docs" : hasAdded ? "feat" : "chore";
  const topFiles = targetFiles
    .slice(0, 3)
    .map((f) => basename(f.path))
    .join(", ");
  const suffix = targetFiles.length > 3 ? ` 等 ${targetFiles.length} 个文件` : "";
  const extra = gitSettings.commitInstructions.trim();
  const body = extra ? `\n\n# 已应用提交指令：${extra}` : "";
  return {
    message: `${prefix}: update ${topFiles}${suffix}${body}`,
    appliedInstructions: extra,
  };
}

/** 用当前分支与变更摘要草拟 PR 标题和正文。 */
export function buildPrDraft(status: GitStatusSnapshot, gitSettings: GitCodingSettings): {
  title: string;
  body: string;
  mergeMethod: string;
  draft: boolean;
  pushCommand: string;
} {
  const latestCommit = status.commits[0]?.subject || `Update ${status.branch || "feature"} changes`;
  const changedList = status.files
    .slice(0, 12)
    .map((f) => `- \`${f.displayCode}\` ${f.path}`)
    .join("\n");
  const commitList = status.commits
    .slice(0, 5)
    .map((c) => `- \`${c.shortHash}\` ${c.subject}`)
    .join("\n");
  const prNote = gitSettings.prInstructions.trim()
    ? `\n\n### Pull Request 指引要求\n${gitSettings.prInstructions.trim()}`
    : "";
  const pushFlag = gitSettings.alwaysForcePush ? " --force-with-lease" : "";
  const mergeLabel = gitSettings.prMergeMethod === "squash" ? "压缩合并 (Squash)" : "标准合并 (Merge)";

  return {
    title: gitSettings.createDraftPr ? `[Draft] ${latestCommit}` : latestCommit,
    body: [
      `## 变更概览`,
      `- 分支：\`${status.branch || "HEAD"}\``,
      `- 合并策略：${mergeLabel}`,
      `- 默认草稿 PR：${gitSettings.createDraftPr ? "是" : "否"}`,
      commitList ? `\n### 最近提交\n${commitList}` : "",
      changedList ? `\n### 当前未提交变更 (${status.files.length})\n${changedList}` : "",
      prNote,
    ]
      .filter(Boolean)
      .join("\n"),
    mergeMethod: gitSettings.prMergeMethod,
    draft: gitSettings.createDraftPr,
    pushCommand: `git push -u origin ${status.branch || "HEAD"}${pushFlag}`,
  };
}
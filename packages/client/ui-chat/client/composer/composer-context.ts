// 管理输入栏附件上下文芯片、@ 提及指令检索提取以及发送前上下文拼装的纯函数（无 DOM 依赖）。
import type { ChatSessionItem } from "../store/chat-types";
import { extractAbsolutePaths } from "./composer-paths";
import type { ChatLocaleMessages } from "../locales";
import type { MediaSource } from "@lfaa/client-ui-tool-media/client";

/** 记录已加入输入框并随发送提交的上下文条目。 */
export interface ComposerAttachment {
  id: string;
  kind: "file" | "folder" | "session" | "mode" | "skill";
  label: string;
  detail?: string;
  contentPreview?: string;
  /** 已上传到本机会话附件库后的 id；Agent 可用 read_attachment 读取。 */
  attachmentId?: string;
  /** 本地图片原件仅用于浏览器预览及会话附件上传。 */
  imageFile?: File;
  /** 聊天内生成图片的来源，用于宿主校验引用归属。 */
  mediaSource?: MediaSource & { sessionId: string; url: string };
  /** 本机绝对路径（粘贴/输入路径时只传路径，不复制字节）。 */
  path?: string;
  modeId?: "goal" | "plan";
  skillId?: string;
}

/** 统一提及弹层中的项目、会话及其他可选项。 */
export interface MentionEntry {
  id: string;
  group: "add" | "sessions" | "plugins";
  icon: "paperclip" | "folder" | "target" | "bulb" | "chat" | "puzzle" | "browser" | "desktop";
  title: string;
  description?: string;
  rightTag?: string;
  disabled?: boolean;
  actionKind: "pick_files" | "focus_project" | "mode_goal" | "mode_plan" | "attach_session" | "unconnected";
  session?: ChatSessionItem;
}

// 从光标前文本提取正在输入的 $ 技能指令关键字；例如 "$count" 返回 { query: "count", startIndex: 0 }。
export function extractTrailingSkillQuery(
  text: string,
  cursorPos: number,
): { query: string; startIndex: number } | null {
  const head = text.slice(0, Math.max(0, cursorPos));
  const match = /(?:^|\s)\$([^\s$]*)$/u.exec(head);
  if (!match) return null;
  const full = match[0];
  const dollarOffset = full.lastIndexOf("$");
  const startIndex = head.length - full.length + dollarOffset;
  return {
    query: match[1] ?? "",
    startIndex,
  };
}

// 从光标前文本提取正在输入的 / 斜杠指令关键字；例如 "/pl" 返回 { query: "pl", startIndex: 0 }。
export function extractTrailingSlashQuery(
  text: string,
  cursorPos: number,
): { query: string; startIndex: number } | null {
  const head = text.slice(0, Math.max(0, cursorPos));
  const match = /(?:^|\s)\/([^\s/]*)$/u.exec(head);
  if (!match) return null;
  const full = match[0];
  const slashOffset = full.lastIndexOf("/");
  const startIndex = head.length - full.length + slashOffset;
  return {
    query: match[1] ?? "",
    startIndex,
  };
}

/** 描述输入框可显示和执行的斜杠命令。 */
export interface SlashCommandEntry {
  id: string;
  command: string;
  title: string;
  desc: string;
  actionKind: "mode_plan" | "mode_goal" | "new_chat" | "clear_draft" | "open_settings" | "host";
  /** Host 注册命令的名称（不含前导 /），仅 actionKind === "host" 时存在。 */
  hostName?: string;
}

/** Host 通过 /api/commands 暴露的命令视图。 */
export interface HostCommandItem {
  name: string;
  title: string;
  description: string;
  argsHint?: string;
  kind: "prompt" | "message";
  source: string;
}

/** 把 Host 注册命令合并进客户端内置斜杠命令列表。 */
export function mergeHostCommands(
  base: SlashCommandEntry[],
  hostCommands: HostCommandItem[],
  isZh: boolean,
): SlashCommandEntry[] {
  const merged = [...base];
  for (const command of hostCommands) {
    const slash = `/${command.name}`;
    if (merged.some((entry) => entry.command === slash)) continue;
    merged.push({
      id: `host-${command.name}`,
      command: slash,
      title: command.title,
      desc: command.argsHint ? `${command.description} ${isZh ? "参数" : "args"}：${command.argsHint}` : command.description,
      actionKind: "host",
      hostName: command.name,
    });
  }
  return merged;
}

/** 组装输入框当前能提供的斜杠命令及其语言标签。 */
export function buildSlashCommands(isZh: boolean): SlashCommandEntry[] {
  return [
    {
      id: "slash-plan",
      command: "/plan",
      title: isZh ? "计划模式" : "Plan mode",
      desc: isZh ? "先输出分步计划与影响范围，再执行修改" : "Draft a step-by-step plan before editing",
      actionKind: "mode_plan",
    },
    {
      id: "slash-goal",
      command: "/goal",
      title: isZh ? "长期目标" : "Goal mode",
      desc: isZh ? "设定可持续追踪与推进的多步目标" : "Set a multi-step persistent goal",
      actionKind: "mode_goal",
    },
    {
      id: "slash-new",
      command: "/new",
      title: isZh ? "新聊天" : "New chat",
      desc: isZh ? "清空当前会话上下文并开始新对话" : "Start a fresh conversation",
      actionKind: "new_chat",
    },
    {
      id: "slash-clear",
      command: "/clear",
      title: isZh ? "清空输入" : "Clear draft",
      desc: isZh ? "清除当前输入框中的文字内容" : "Clear the current composer draft",
      actionKind: "clear_draft",
    },
    {
      id: "slash-settings",
      command: "/settings",
      title: isZh ? "打开设置" : "Open settings",
      desc: isZh ? "前往模型配置与通用设置中心" : "Open model & general settings",
      actionKind: "open_settings",
    },
  ];
}

/** 按输入内容搜索斜杠命令，供菜单更新当前候选项。 */
export function filterSlashCommands(entries: SlashCommandEntry[], query: string): SlashCommandEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((item) =>
    item.command.toLowerCase().includes(q)
    || item.title.toLowerCase().includes(q)
    || item.desc.toLowerCase().includes(q),
  );
}

// 从光标前文本提取正在输入的 @ 检索关键字；例如 "请参考 @计划" 返回 { query: "计划", startIndex: 4 }。
export function extractTrailingMentionQuery(
  text: string,
  cursorPos: number,
): { query: string; startIndex: number } | null {
  const head = text.slice(0, Math.max(0, cursorPos));
  const match = /(?:^|\s)@([^\s@]*)$/u.exec(head);
  if (!match) return null;
  const full = match[0];
  const atOffset = full.lastIndexOf("@");
  const startIndex = head.length - full.length + atOffset;
  return {
    query: match[1] ?? "",
    startIndex,
  };
}

/** 将工作台提供的上下文转换为提及菜单选项。 */
export function buildMentionEntries({
  locale,
  sessions,
  activeSessionId,
}: {
  locale: ChatLocaleMessages;
  sessions: ChatSessionItem[];
  activeSessionId: string | null;
}): MentionEntry[] {
  const entries: MentionEntry[] = [
    {
      id: "add-files",
      group: "add",
      icon: "paperclip",
      title: locale.mentionFilesAndFolders,
      actionKind: "pick_files",
    },
    {
      id: "add-project",
      group: "add",
      icon: "folder",
      title: locale.mentionUseProject,
      actionKind: "focus_project",
    },
    {
      id: "add-goal",
      group: "add",
      icon: "target",
      title: locale.mentionGoalTitle,
      description: locale.mentionGoalDesc,
      actionKind: "mode_goal",
    },
    {
      id: "add-plan",
      group: "add",
      icon: "bulb",
      title: locale.mentionPlanTitle,
      description: locale.mentionPlanDesc,
      actionKind: "mode_plan",
    },
  ];

  for (const session of sessions.slice(0, 12)) {
    if (session.archived || session.id === activeSessionId) continue;
    entries.push({
      id: `session-${session.id}`,
      group: "sessions",
      icon: "chat",
      title: session.title,
      rightTag: locale.mentionSessionTag,
      actionKind: "attach_session",
      session,
    });
  }

  const placeholderPlugins: Array<{ id: string; title: string; desc: string; icon: MentionEntry["icon"] }> = [
    { id: "plugin-browser", title: locale.ctxBrowser, desc: "Control the in-app browser", icon: "browser" },
    { id: "plugin-desktop", title: locale.isZh ? "电脑" : "Desktop", desc: "Control Windows apps", icon: "desktop" },
    { id: "plugin-canva", title: "Canva", desc: "Create, review, edit designs", icon: "puzzle" },
    { id: "plugin-docs", title: "Documents", desc: "Create and edit documents", icon: "puzzle" },
  ];
  for (const plugin of placeholderPlugins) {
    entries.push({
      id: plugin.id,
      group: "plugins",
      icon: plugin.icon,
      title: plugin.title,
      description: plugin.desc,
      rightTag: locale.mentionUnconnectedTag,
      actionKind: "unconnected",
    });
  }

  return entries;
}

/** 根据提及查询筛选候选项，保留对应选择信息。 */
export function filterMentionEntries(entries: MentionEntry[], query: string): MentionEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) =>
    entry.title.toLowerCase().includes(needle)
    || Boolean(entry.description && entry.description.toLowerCase().includes(needle)),
  );
}

// 把用户勾选的文件、文件夹、历史对话和模式标签注入最终发给 Agent 的消息上下文。
export function buildContextualMessage(userText: string, attachments: ComposerAttachment[]): string {
  const cleanText = userText.trim();
  const typedPathsAll = extractAbsolutePaths(cleanText);
  if (attachments.length === 0 && typedPathsAll.length === 0) return cleanText;

  const blocks: string[] = [];
  for (const item of attachments) {
    if (item.kind === "mode") {
      if (item.modeId === "goal") {
        blocks.push("[模式约束：持续目标模式] 请围绕该目标拆分步骤并持续推进验证，直到目标闭环达成。");
      } else if (item.modeId === "plan") {
        blocks.push("[模式约束：计划模式] 请先将任务拆分为清晰的分步实施计划（含每步目标、涉及文件与验证方式），然后严格按步骤依次执行并在每步完成后汇报进度与结果。");
      }
    } else if (item.kind === "session") {
      blocks.push(`[引用历史对话：${item.label}]${item.detail ? `\n${item.detail}` : ""}`);
    } else if (item.kind === "folder") {
      blocks.push(`[附加文件夹：${item.label}]${item.contentPreview ? `\n${item.contentPreview}` : ""}`);
    } else if (item.path) {
      blocks.push(`[本地文件路径：${item.path}] 需要内容时直接读取该绝对路径。`);
    } else {
      const savedHint = item.attachmentId ? `\n附件已保存到本机会话附件库（id=${item.attachmentId}），需要完整原文时调用 read_attachment 读取。` : "";
      blocks.push(`[附加文件：${item.label}${item.detail ? ` (${item.detail})` : ""}]${savedHint}${item.contentPreview ? `\n\`\`\`\n${item.contentPreview}\n\`\`\`` : ""}`);
    }
  }

  // 文本里直接输入的绝对路径也补一条本地文件上下文，避免用户手打路径时丢失意图。
  const typedPaths = extractAbsolutePaths(cleanText).filter((path) => !blocks.some((block) => block.includes(path)));
  for (const path of typedPaths) blocks.push(`[本地文件路径：${path}] 需要内容时直接读取该绝对路径。`);

  return `${blocks.join("\n\n")}\n\n${cleanText}`;
}

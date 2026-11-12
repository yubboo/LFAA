/**
 * 功能：为侧栏会话解析稳定的主题图标。
 * 作用：先使用标题摘要识别主题，再回退到会话 App 范围；不读取会话正文或发起分类请求。
 * 关联文件：ApplicationWorkspace.tsx、ui-primitives/WorkbenchIcon.tsx。
 */
import type { AiSession } from "lfaa-client-connection/src/api.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

type SessionIconSubject = Pick<AiSession, "appId" | "title"> & Partial<Pick<AiSession, "projectTitle">>;

interface SessionTopicIconRule {
  id: string;
  icon: WorkbenchIconName;
  pattern: RegExp;
}

/** 标题/项目摘要主题映射的唯一表；增加主题时只需在此登记同义表达和共享图标。 */
export const SESSION_TOPIC_ICON_RULES: readonly SessionTopicIconRule[] = [
  { id: "minecraft", icon: "cube", pattern: /Minecraft|我的世界|(^|[^A-Za-z])MC([^A-Za-z]|$)/iu },
  { id: "mobile", icon: "mobile", pattern: /手机|移动端|移动设备|安卓|Android|iOS|iPhone|iPad/iu },
  { id: "browser", icon: "browser", pattern: /浏览器|网页|网站|Chrome|Edge|URL/iu },
  { id: "writing", icon: "book", pattern: /写作|小说|文章|文案|章节|书稿/iu },
  { id: "video", icon: "film", pattern: /视频|漫剧|剪辑|分镜/iu },
  { id: "terminal", icon: "terminal", pattern: /终端|PowerShell|Shell|命令行|命令工具/iu },
  { id: "code", icon: "branch", pattern: /代码|编程|软件开发|TypeScript|React|调试/iu },
  { id: "canvas", icon: "grid", pattern: /画布|工作流|节点/iu },
];

const APPLICATION_SESSION_ICONS: Partial<Record<ApplicationId, WorkbenchIconName>> = {
  steamcmd: "monitor",
  minecraft: "cube",
  connectivity: "branch",
  writing: "book",
  aivideo: "film",
};

export function resolveAiSessionIconName(session: SessionIconSubject): WorkbenchIconName {
  const summary = `${session.title} ${session.projectTitle ?? ""}`.normalize("NFKC");
  const topic = SESSION_TOPIC_ICON_RULES.find(rule => rule.pattern.test(summary));
  return topic?.icon ?? APPLICATION_SESSION_ICONS[session.appId] ?? "chat";
}

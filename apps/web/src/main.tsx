// 创建浏览器 Cordis 上下文，装配共享四栏 Shell、主题外观插件、自定义分区插件与工作区项目插件。
import { Context } from "@deepseek-ai/cordis";
import { chatClientPlugin } from "@lfaa/chat/client";
import { pluginsClientPlugin } from "@lfaa/plugins/client";
import { sectionsClientPlugin } from "@lfaa/sections/client";
import { skillsClientPlugin } from "@lfaa/skills/client";
import { workbenchPlugin } from "@lfaa/ui-layout/client";
import { themeClientPlugin } from "@lfaa/ui-theme/client";
import { workspaceClientPlugin } from "@lfaa/workspace/client";
import "./app.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("找不到 Web 挂载节点 #root");
}

const context = new Context();
let markPluginsReady!: () => void;
const pluginsReady = new Promise<void>((resolve) => {
  markPluginsReady = resolve;
});
const workbench = context.plugin(workbenchPlugin, { container: rootElement, ready: pluginsReady });
const theme = context.plugin(themeClientPlugin);
const sections = context.plugin(sectionsClientPlugin);
const workspace = context.plugin(workspaceClientPlugin);
const chat = context.plugin(chatClientPlugin);
const skills = context.plugin(skillsClientPlugin);
const plugins = context.plugin(pluginsClientPlugin);

void Promise.allSettled([theme, sections, workspace, chat, skills, plugins]).then(() => markPluginsReady());

// 页面卸载时依次释放业务插件与 Shell 插件，确保所有贡献和 React 根节点清理。
window.addEventListener("pagehide", () => {
  void plugins.dispose();
  void skills.dispose();
  void chat.dispose();
  void workspace.dispose();
  void sections.dispose();
  void theme.dispose();
  void workbench.dispose();
}, { once: true });

// 把插件安装失败显示在控制台，并保持页面可调试。
void Promise.all([workbench, theme, sections, workspace, chat, skills, plugins]).catch((error: unknown) => {
  console.error("LFAA 工作区启动失败：", error);
});

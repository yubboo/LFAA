// 创建浏览器 Cordis 上下文，装配共享四栏 Shell、主题外观插件、自定义分区插件与工作区项目插件。
import { Context } from "@deepseek-ai/cordis";
import { browserClientPlugin } from "@lfaa/browser/client";
import { chatClientPlugin } from "@lfaa/chat/client";
import { libraryClientPlugin } from "@lfaa/library/client";
import { pluginsClientPlugin } from "@lfaa/plugins/client";
import { reviewClientPlugin } from "@lfaa/review/client";
import { sectionsClientPlugin } from "@lfaa/sections/client";
import { skillsClientPlugin } from "@lfaa/skills/client";
import { workbenchPlugin } from "@lfaa/ui-layout/client";
import { themeClientPlugin } from "@lfaa/ui-theme/client";
import { workspaceClientPlugin } from "@lfaa/workspace/client";
import { installApiToken } from "./api-auth";
import "./app.css";

// 必须先装好令牌注入：插件在实例化时就会发起 /api 请求。
installApiToken();

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
// 资料库与代码审查依赖 chat 提供的 chatStore 服务，必须排在 chat 之后。
const library = context.plugin(libraryClientPlugin);
const review = context.plugin(reviewClientPlugin);
const browser = context.plugin(browserClientPlugin);
const skills = context.plugin(skillsClientPlugin);
const plugins = context.plugin(pluginsClientPlugin);

void Promise.allSettled([theme, sections, workspace, chat, library, review, browser, skills, plugins]).then(() => markPluginsReady());

// 页面卸载时依次释放业务插件与 Shell 插件，确保所有贡献和 React 根节点清理。
window.addEventListener("pagehide", () => {
  void plugins.dispose();
  void skills.dispose();
  void browser.dispose();
  void review.dispose();
  void library.dispose();
  void chat.dispose();
  void workspace.dispose();
  void sections.dispose();
  void theme.dispose();
  void workbench.dispose();
}, { once: true });

// 把插件安装失败显示在控制台，并保持页面可调试。
void Promise.all([workbench, theme, sections, workspace, chat, library, review, browser, skills, plugins]).catch((error: unknown) => {
  console.error("LFAA 工作区启动失败：", error);
});

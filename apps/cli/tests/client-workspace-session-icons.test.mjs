import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveAiSessionIconName } from "../../../packages/client/ui-workspace/src/session-icon.ts";

const sidebar = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../../packages/client/ui-workspace/src/css/secondary-navigation.css", import.meta.url), "utf8");
const icons = readFileSync(new URL("../../../packages/client/ui-primitives/src/WorkbenchIcon.tsx", import.meta.url), "utf8");

test("会话主题图标从短标题摘要识别 MC 与手机主题，未知标题安全回退", () => {
  assert.equal(resolveAiSessionIconName({ appId: "workspace", title: "Minecraft Java 服务器" }), "cube");
  assert.equal(resolveAiSessionIconName({ appId: "workspace", title: "MC 服工作流" }), "cube");
  assert.equal(resolveAiSessionIconName({ appId: "workspace", title: "手机端聊天适配" }), "mobile");
  assert.equal(resolveAiSessionIconName({ appId: "workspace", title: "MCP 工具连接" }), "chat", "MCP 不得误判成 MC");
  assert.equal(resolveAiSessionIconName({ appId: "minecraft", title: "会话处理" }), "cube", "没有主题词时保留 Minecraft App 语境");
  assert.equal(resolveAiSessionIconName({ appId: "workspace", title: "未分类任务" }), "chat");
});

test("会话图标和标题占用独立盒子，图标保持统一尺寸", () => {
  assert.match(sidebar, /className="module-sidebar__session-icon"[\s\S]*?size=\{14\}/u);
  assert.match(sidebar, /className="module-sidebar__session-title"/u);
  assert.match(styles, /\.module-sidebar__session-icon \{ display: grid; width: 16px; height: 16px; flex: 0 0 16px/u);
  assert.match(styles, /\.module-sidebar__session-icon > svg \{ display: block; width: 14px; height: 14px; \}/u);
  assert.match(icons, /cube: </u);
  assert.match(icons, /mobile: </u);
  assert.match(icons, /film: </u);
});

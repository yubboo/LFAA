// 临时夹具：在 ~/.lfaa/sessions 生成一个 80 条消息的会话，用于验证窗口化。用完即删。
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const id = "00000000-0000-4000-8000-000000000001";
const now = Date.now();
const messages = [];
for (let i = 0; i < 40; i += 1) {
  messages.push({
    id: `perf-user-${i}`,
    role: "user",
    content: `第 ${i + 1} 轮：帮我确认窗口化后的滚动与定位是否还正常，这是用于压测历史长度的合成消息。`,
    createdAt: now - (40 - i) * 600000,
  });
  messages.push({
    id: `perf-assistant-${i}`,
    role: "assistant",
    status: "done",
    model: "deepseek-v4.1-flash",
    createdAt: now - (40 - i) * 600000 + 30000,
    content: [
      `第 ${i + 1} 轮回复：下面是本轮结论。`,
      "",
      `1. 渲染窗口只保留可视区附近的消息，历史长度不再线性放大 DOM 规模。`,
      `2. 滚动位置由 useChatScroll 独占，窗口化不写 scrollTop。`,
      `3. 锚点跳转与搜索定位都要先把目标消息滚进窗口，再按真实几何精调。`,
      "",
      "```ts",
      `const round = ${i + 1};`,
      "console.log(round);",
      "```",
      "",
      `本轮编号 ${i + 1}，用于验证长会话下的滚动、贴底与定位。`,
    ].join("\n"),
    reasoning: `第 ${i + 1} 轮的思考过程摘要，用于撑起行高。`,
    steps: [],
  });
}

const payload = {
  id,
  title: "窗口化压测会话（临时）",
  projectId: null,
  sectionId: null,
  pinned: false,
  archived: false,
  messageCount: messages.length,
  createdAt: now - 40 * 600000,
  updatedAt: now,
  messages,
  unread: false,
};
const file = join(homedir(), ".lfaa", "sessions", `${id}.json`);
writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
console.log(file, messages.length, "messages");
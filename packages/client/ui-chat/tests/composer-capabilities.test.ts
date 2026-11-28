// 输入栏「技能 / 插件」内联搜索纯逻辑与上下文注入单测。
// 关联：packages/client/ui-chat/client/composer/composer-capabilities.ts；运行环境：Node.js（node:test）。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCapabilitySections, splitHighlightParts } from "../client/composer/composer-capabilities";
import { buildContextualMessage } from "../client/composer/composer-context";

describe("composer-capabilities", () => {
  const skills = [
    { id: "s1", name: "xiaoyu-xiaoban-img", description: "小板图样板图修图生成" },
    { id: "s2", name: "game-ui-asset-pipeline", description: "Pack game UI PNG assets" },
  ];
  const plugins = [
    { name: "@lfaa/canvas", title: "无限画布", description: "图片与视频画布", enabled: true },
    { name: "@lfaa/disabled", title: "停用插件", description: "不应展示", enabled: false },
  ];

  it("builds frequent, quick actions, and skills sections when query is empty", () => {
    const { sections } = buildCapabilitySections("skill", {
      skills,
      plugins,
      frequentIds: ["skill:s1", "action:canvas"],
      query: "",
      isZh: true,
    });
    assert.deepEqual(sections.map((s) => s.id), ["frequent", "actions", "skills"]);
    assert.deepEqual(sections[0]?.items.map((i) => i.id), ["skill:s1", "action:canvas"]);
    assert.equal(sections[2]?.items.length, 2);
  });

  it("filters by query across actions/skills and splits case-insensitive highlights", () => {
    const { flatEntries } = buildCapabilitySections("skill", {
      skills,
      plugins,
      frequentIds: [],
      query: "XiaoYu",
      isZh: true,
    });
    assert.deepEqual(flatEntries.map((i) => i.title), ["xiaoyu-xiaoban-img"]);

    const parts = splitHighlightParts("xiaoyu-xiaoban-img", "XiaoYu");
    assert.deepEqual(parts, [
      { text: "xiaoyu", match: true },
      { text: "-xiaoban-img", match: false },
    ]);
  });

  it("excludes disabled plugins and injects skill/plugin context blocks on submit", () => {
    const { flatEntries } = buildCapabilitySections("plugin", {
      skills,
      plugins,
      frequentIds: [],
      query: "",
      isZh: true,
    });
    assert.deepEqual(
      flatEntries.filter((i) => i.kind === "plugin").map((i) => i.pluginName),
      ["@lfaa/canvas"],
    );
    assert.deepEqual(
      flatEntries.filter((i) => i.kind === "action").map((i) => i.actionId),
      ["add-plugin", "manage-plugins"],
    );

    const message = buildContextualMessage("帮我生成一张图", [
      { id: "skill-s1", kind: "skill", skillId: "s1", label: "xiaoyu-xiaoban-img" },
      { id: "plugin-c", kind: "plugin", pluginName: "@lfaa/canvas", label: "无限画布" },
    ]);
    assert.match(message, /\[调用技能：xiaoyu-xiaoban-img\]/);
    assert.match(message, /\[调用插件：无限画布\]/);
    assert.ok(message.endsWith("帮我生成一张图"));
  });
});

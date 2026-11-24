// @lfaa/skills 生命周期与二创回归测试：覆盖个人/项目/插件技能发现、版本冲突、二创复制与运行前校验。
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { parseSkillMarkdown, skillsPlugin } from "../src/index";

test("技能新增、版本冲突保护、项目技能发现、二创复制与停用校验", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-skills-test-"));
  const personalDir = join(root, "personal");
  const builtinDir = join(root, "builtin");
  const projectDir = join(root, "project");
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  await mkdir(join(builtinDir, "demo-builtin"), { recursive: true });
  await writeFile(
    join(builtinDir, "demo-builtin", "SKILL.md"),
    "---\nname: 内置示例技能\ndescription: 不可删除的内置技能\n---\n\n内置正文。",
    "utf8",
  );

  await mkdir(join(projectDir, ".agent", "skills", "dev-only"), { recursive: true });
  await writeFile(
    join(projectDir, ".agent", "skills", "dev-only", "SKILL.md"),
    "---\nname: 仅限开发工具\ndescription: 不应被小鱼读取\n---\n\n忽略。",
    "utf8",
  );
  await mkdir(join(projectDir, ".lfaa", "skills", "demo-proj"), { recursive: true });
  await writeFile(
    join(projectDir, ".lfaa", "skills", "demo-proj", "SKILL.md"),
    "---\nname: 项目规范\ndescription: 项目内置规范\n---\n\n遵循项目约定。",
    "utf8",
  );

  const ctx = new Context();
  const fiber = ctx.plugin(skillsPlugin, { personalDir, builtinDir });
  await fiber;
  t.after(async () => {
    await fiber.dispose();
  });

  // 1. 新增个人技能并验证乐观锁版本冲突
  const created = await ctx.skills.createOrUpdateSkill({
    name: "我的审校",
    description: "审校清单",
    content: "# 步骤\n1. 检查边界",
  });
  assert.equal(created.revision, 1);
  assert.equal(created.editable, true);

  const updated = await ctx.skills.createOrUpdateSkill({
    id: created.id,
    name: "我的审校",
    content: "# 步骤\n1. 检查边界与类型",
    expectedRevision: 1,
  });
  assert.equal(updated.revision, 2);

  await assert.rejects(
    () =>
      ctx.skills.createOrUpdateSkill({
        id: created.id,
        name: "我的审校",
        content: "过期覆盖",
        expectedRevision: 1,
      }),
    /版本冲突/,
  );

  // 2. 发现内置技能（不可删除）与 .lfaa/skills 项目技能（忽略 .agent/skills）并二创为个人版本
  const list = await ctx.skills.listSkills({ projectRoots: [projectDir] });
  assert.equal(list.some((s) => s.name === "仅限开发工具"), false);
  const builtinSkill = list.find((s) => s.source === "builtin");
  assert.ok(builtinSkill);
  assert.equal(builtinSkill.editable, false);
  await assert.rejects(() => ctx.skills.deleteSkill(builtinSkill.id), /不可删除/);
  const projSkill = list.find((s) => s.source === "project");
  assert.ok(projSkill);
  assert.equal(projSkill.editable, false);

  const forked = await ctx.skills.forkSkill(projSkill.id, [projectDir]);
  assert.equal(forked.source, "personal");
  assert.equal(forked.editable, true);
  assert.equal(forked.originSkillId, projSkill.id);

  // 3. 启用与停用校验：停用后 resolveSkillsForRun 拒绝执行
  const resolvedOk = await ctx.skills.resolveSkillsForRun([forked.id], [projectDir]);
  assert.equal(resolvedOk.length, 1);

  await ctx.skills.setSkillEnabled(forked.id, false, [projectDir]);
  await assert.rejects(() => ctx.skills.resolveSkillsForRun([forked.id], [projectDir]), /已停用/);

  await ctx.skills.setSkillEnabled(forked.id, true, [projectDir]);
  assert.equal(await ctx.skills.deleteSkill(forked.id), true);
});

test("默认内置技能目录包含 minecraft-plugin-dev 与 lfaa-skill-creator 且可读取正文", async (t) => {
  const personalDir = await mkdtemp(join(tmpdir(), "lfaa-builtin-skills-"));
  t.after(async () => {
    await rm(personalDir, { recursive: true, force: true });
  });

  const ctx = new Context();
  const fiber = ctx.plugin(skillsPlugin, { personalDir });
  await fiber;
  t.after(async () => {
    await fiber.dispose();
  });

  const list = await ctx.skills.listSkills({ includeDisabled: false });
  assert.ok(list.some((s) => s.id === "builtin:lfaa-skill-creator"));
  const mcSkill = list.find((s) => s.id === "builtin:minecraft-plugin-dev");
  assert.ok(mcSkill, "应发现内置 minecraft-plugin-dev 技能");

  const detail = await ctx.skills.getSkillDetail("builtin:minecraft-plugin-dev");
  assert.ok(detail?.content.includes("Paper"));
  assert.ok(detail?.content.includes("Comparator"));
  assert.ok(detail?.content.includes("run_command"));
});

test("拒绝路径穿越技能 ID 且支持无状态记录的手动个人技能启停", async (t) => {
  const personalDir = await mkdtemp(join(tmpdir(), "lfaa-skills-sec-"));
  t.after(async () => {
    await rm(personalDir, { recursive: true, force: true });
  });

  await mkdir(join(personalDir, "manual-skill"), { recursive: true });
  await writeFile(
    join(personalDir, "manual-skill", "SKILL.md"),
    "---\nname: 手动技能\ndescription: 人工放置的技能\n---\n\n正文",
    "utf8",
  );

  const ctx = new Context();
  const fiber = ctx.plugin(skillsPlugin, { personalDir });
  await fiber;
  t.after(async () => {
    await fiber.dispose();
  });

  for (const badId of ["../escape", "..\\escape", "a/b", ".hidden"]) {
    await assert.rejects(
      () => ctx.skills.createOrUpdateSkill({ id: badId, name: "非法", content: "正文" }),
      /不合法|越界/,
    );
    await assert.rejects(() => ctx.skills.deleteSkill(badId), /不合法|越界/);
  }

  const disabled = await ctx.skills.setSkillEnabled("manual-skill", false);
  assert.equal(disabled.enabled, false);
  const reenabled = await ctx.skills.setSkillEnabled("manual-skill", true);
  assert.equal(reenabled.enabled, true);
});

test("全部 11 组新增内置技能均可被发现、描述解析完整且支持多行 YAML frontmatter", async (t) => {
  const personalDir = await mkdtemp(join(tmpdir(), "lfaa-all-builtins-"));
  t.after(async () => {
    await rm(personalDir, { recursive: true, force: true });
  });

  // 校验多行 YAML 块标量解析
  const parsedBlock = parseSkillMarkdown(
    "---\nname: multi-line-demo\ndescription: >-\n  第一行说明\n  第二行说明\nmetadata:\n  version: 1.0.0\n---\n\n正文内容",
    "fallback",
  );
  assert.equal(parsedBlock.name, "multi-line-demo");
  assert.equal(parsedBlock.description, "第一行说明 第二行说明");

  const ctx = new Context();
  const fiber = ctx.plugin(skillsPlugin, { personalDir });
  await fiber;
  t.after(async () => {
    await fiber.dispose();
  });

  const allBuiltins = (await ctx.skills.listSkills({ includeDisabled: true })).filter((s) => s.source === "builtin");
  assert.equal(allBuiltins.length, 40, `期望 40 个内置技能（已移除空壳与重复），实际 ${allBuiltins.length}`);

  const enabledBuiltins = (await ctx.skills.listSkills({ includeDisabled: false })).filter((s) => s.source === "builtin");
  assert.equal(enabledBuiltins.length, 26, `期望默认启用 26 个核心内置技能，实际 ${enabledBuiltins.length}`);

  const requiredEnabledIds = [
    "builtin:lfaa-skill-creator",
    "builtin:minecraft-plugin-dev",
    "builtin:stageshow",
    "builtin:dimensional-drawing",
    "builtin:dimensional-drawing-motion",
    "builtin:device-frames",
    "builtin:fixing-accessibility",
    "builtin:animate",
    "builtin:review-animations",
    "builtin:emil-design-eng",
    "builtin:unslop",
    "builtin:impeccable",
    "builtin:media-use",
    "builtin:agent-browser",
    "builtin:find-skills",
    "builtin:ui-taste",
    "builtin:ios-design",
    "builtin:code-review",
  ];
  const enabledById = new Map(enabledBuiltins.map((s) => [s.id, s]));
  for (const id of requiredEnabledIds) {
    assert.ok(enabledById.has(id), `缺少默认启用的内置技能 ${id}`);
  }

  // 默认未启用的内置技能仍可被发现，且支持一键启用并持久化
  const defaultOff = allBuiltins.find((s) => s.id === "builtin:baseline-ui");
  assert.ok(defaultOff && defaultOff.enabled === false, "baseline-ui 应默认未启用");
  const turnedOn = await ctx.skills.setSkillEnabled("builtin:baseline-ui", true);
  assert.equal(turnedOn.enabled, true);
  const afterEnable = await ctx.skills.listSkills({ includeDisabled: false });
  assert.ok(afterEnable.some((s) => s.id === "builtin:baseline-ui"));
  const turnedOffAgain = await ctx.skills.setSkillEnabled("builtin:baseline-ui", false);
  assert.equal(turnedOffAgain.enabled, false);

  for (const skill of allBuiltins) {
    assert.ok(skill.name.trim().length > 0, `${skill.id} 名称不应为空`);
    assert.ok(skill.description.trim().length > 5, `${skill.id} 描述不应为空或过短: "${skill.description}"`);
    assert.ok(!/^[|>][+-]?$/u.test(skill.description.trim()), `${skill.id} 描述未展开多行 YAML 块标量`);
  }
});

// 验证项目简介生成器：README 摘要、清单兜底、空目录兜底与长度上限。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { draftProjectBrief, firstReadableParagraph, stripMarkdown } from "../src/project-brief";

test("从 README 提取首段正文并跳过标题与语言切换行", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-brief-readme-"));
  try {
    await fs.writeFile(path.join(root, "README.md"), [
      "# 海洋图片项目",
      "",
      "English | [中文](README.zh.md)",
      "",
      "本项目用于生成和整理海洋主题图片，交付物为可复用的图片素材。",
    ].join("\n"), "utf8");
    await fs.mkdir(path.join(root, "assets"));

    const draft = await draftProjectBrief("海洋图片", root);
    assert.match(draft.brief, /「海洋图片」/u);
    assert.match(draft.brief, /海洋主题图片/u);
    assert.match(draft.brief, /assets\//u);
    assert.ok(draft.sources.includes("README.md"));
    assert.ok(draft.sources.includes("目录条目"));
    assert.ok(draft.brief.length <= 500);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("README 缺失时使用 package.json 描述，空目录给出可编辑兜底文案", async () => {
  const withPkg = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-brief-pkg-"));
  const empty = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-brief-empty-"));
  try {
    await fs.writeFile(path.join(withPkg, "package.json"), JSON.stringify({
      name: "ocean-images",
      description: "生成海洋图片素材并归档到资料库",
    }), "utf8");
    const fromPkg = await draftProjectBrief("素材库", withPkg);
    assert.match(fromPkg.brief, /生成海洋图片素材并归档到资料库/u);
    assert.ok(fromPkg.sources.includes("package.json"));

    const fallback = await draftProjectBrief("空项目", empty);
    assert.match(fallback.brief, /尚未填写项目目标与交付范围/u);
    assert.deepEqual(fallback.sources, []);
  } finally {
    await fs.rm(withPkg, { recursive: true, force: true });
    await fs.rm(empty, { recursive: true, force: true });
  }
});

test("Markdown 清理与首段选取保持稳定", () => {
  assert.equal(stripMarkdown("## 标题\n\n**加粗** [链接](https://example.com)").includes("#"), false);
  assert.equal(firstReadableParagraph("```\ncode\n```\n\n一段足够长的中文说明文字。"), "一段足够长的中文说明文字。");
  assert.equal(firstReadableParagraph("# 只有标题\n\nEnglish | 中文"), "");
});
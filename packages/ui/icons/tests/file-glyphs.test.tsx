// 验证 @lfaa/ui-icons 的映射与渲染：扩展名、特殊文件名、目录职责都应命中存在的彩色图标，而不是统一兜底。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// tsx 测试运行器使用经典 JSX 转换，需要把 React 挂到全局供组件模块解析。
(globalThis as { React?: typeof React }).React = React;

// 组件测试环境没有 CSS Modules 打包器，用代理把类名原样返回，避免样式导入中断用例。
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default new Proxy({}, { get: (_, k) => String(k) });",
      };
    }
    return nextLoad(url, context);
  },
});

const { FileTypeIcon } = await import("../client/index");
const { GLYPHS } = await import("../client/glyphs");
const { DEFAULT_FILE_GLYPH, resolveFileGlyph, resolveFolderGlyph } = await import("../contract/index");

test("文件扩展名映射到对应的彩色类型图标", () => {
  const cases: Array<[string, string]> = [
    ["service.ts", "file-type-typescript"],
    ["ChatWorkspace.tsx", "file-type-reactts"],
    ["legacy.js", "file-type-js"],
    ["theme.module.css", "file-type-css"],
    ["index.html", "file-type-html"],
    ["server.go", "file-type-go"],
    ["main.rs", "file-type-rust"],
    ["app.py", "file-type-python"],
    ["README.md", "file-type-markdown"],
    ["notes.txt", "file-type-text"],
    ["build.log", "file-type-log"],
    ["photo.png", "file-type-image"],
    ["report.pdf", "file-type-pdf2"],
    ["archive.zip", "file-type-zip"],
    ["deploy.ps1", "file-type-powershell"],
    ["run.sh", "file-type-shell"],
    ["data.sql", "file-type-sql"],
    ["settings.yaml", "file-type-yaml"],
  ];
  for (const [name, glyph] of cases) {
    assert.equal(resolveFileGlyph(name), glyph, `${name} 应使用 ${glyph}`);
  }
});

test("特殊文件名与路径优先于扩展名，未知扩展名回落到默认文件图标", () => {
  assert.equal(resolveFileGlyph("package.json"), "file-type-npm");
  assert.equal(resolveFileGlyph("pom.xml"), "file-type-maven");
  assert.equal(resolveFileGlyph("pnpm-lock.yaml"), "file-type-pnpm");
  assert.equal(resolveFileGlyph("tsconfig.json"), "file-type-tsconfig");
  assert.equal(resolveFileGlyph(".gitignore"), "file-type-git");
  assert.equal(resolveFileGlyph(".env.local"), "file-type-dotenv");
  assert.equal(resolveFileGlyph("Dockerfile"), "file-type-docker");
  assert.equal(resolveFileGlyph("LICENSE"), "file-type-license");
  assert.equal(resolveFileGlyph("src/ChatWorkspace.tsx"), "file-type-reactts");
  assert.equal(resolveFileGlyph("E:\\lfaa\\.gitignore"), "file-type-git");
  assert.equal(resolveFileGlyph("archive.unknownext"), DEFAULT_FILE_GLYPH);
});

test("目录按职责命中彩色文件夹，根目录与展开态使用专用变体", () => {
  assert.equal(resolveFolderGlyph("src"), "folder-type-src");
  assert.equal(resolveFolderGlyph("src", { expanded: true }), "folder-type-src-opened");
  assert.equal(resolveFolderGlyph("docs"), "folder-type-docs");
  assert.equal(resolveFolderGlyph("tests"), "folder-type-test");
  assert.equal(resolveFolderGlyph("assets"), "folder-type-asset");
  assert.equal(resolveFolderGlyph(".git"), "folder-type-git");
  assert.equal(resolveFolderGlyph(".tools"), "folder-type-tools");
  assert.equal(resolveFolderGlyph(".lfaa-media"), "folder-type-asset");
  assert.equal(resolveFolderGlyph("node_modules"), "folder-type-node");
  assert.equal(resolveFolderGlyph("app1"), "default-folder");
  assert.equal(resolveFolderGlyph("app1", { expanded: true }), "default-folder-opened");
  assert.equal(resolveFolderGlyph("app1", { root: true }), "default-root-folder");
  assert.equal(resolveFolderGlyph("app1", { root: true, expanded: true }), "default-root-folder-opened");
});

test("所有映射结果都有对应字形，字形数据非空", () => {
  const names = ["a.ts", "a.tsx", "a.js", "a.jsx", "a.css", "a.json", "a.md", "a.txt", "a.log", "a.pdf", "a.zip", "package.json"];
  for (const name of names) assert.ok(GLYPHS[resolveFileGlyph(name)], name);
  for (const name of ["src", "docs", "tests", "assets", "node_modules", "app1"]) {
    assert.ok(GLYPHS[resolveFolderGlyph(name)], name);
    assert.ok(GLYPHS[resolveFolderGlyph(name, { expanded: true })], `${name} opened`);
  }
  for (const [key, glyph] of Object.entries(GLYPHS)) {
    assert.ok(glyph.body.startsWith("<"), `${key} 缺少 SVG 内容`);
    assert.ok(glyph.w > 0 && glyph.h > 0, `${key} 视窗无效`);
  }
});

test("渲染结果是内联 SVG 并带图标 key，而非文字角标", () => {
  const file = renderToStaticMarkup(createElement(FileTypeIcon, { name: "ChatWorkspace.tsx", kind: "file" }));
  const dir = renderToStaticMarkup(createElement(FileTypeIcon, { name: "packages", kind: "directory", expanded: true }));
  assert.match(file, /^<svg/u);
  assert.match(file, /data-glyph="file-type-reactts"/u);
  assert.match(file, /<path/u);
  assert.match(dir, /data-glyph="folder-type-package-opened"/u);
});
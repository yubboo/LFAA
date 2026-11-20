// 包 README 生成器：按 DSH 结构生成每个包的 README.md（英文）与 README.zh.md（中文）。
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.argv[2] ?? process.cwd();
const PKG_ROOT = join(ROOT, "packages");

/** 英文摘要与分组说明：中文摘要直接取 package.json 的 description。 */
const META = {
  "@lfaa/agent": { en: "Runs the Think → Act → Check loop: assembles the model request, executes tools, and records each step." },
  "@lfaa/browser": { en: "Drives the local Edge/Chrome instance through playwright-core and exposes browser tools to the agent." },
  "@lfaa/chat": { en: "Chat workbench: sessions, streaming runs, the composer, the right-hand workbench, and the settings surfaces." },
  "@lfaa/context": { en: "Context budget: compresses early tool results by character budget and recognises context-overflow errors." },
  "@lfaa/fs": { en: "Workspace filesystem boundary: safe path resolution, private-path filtering, and directory walking." },
  "@lfaa/guard": { en: "Command safety: blocks commands touching private application files, records an audit trail, and normalises timeouts." },
  "@lfaa/jobs": { en: "Session-scoped background tasks: start commands, stream logs, query state, and terminate process trees." },
  "@lfaa/llm": { en: "Model access layer: provider-neutral streaming, tool calling, and credential handling." },
  "@lfaa/memory": { en: "Short-term session trajectories, long-term recall, and library assets." },
  "@lfaa/metrics": { en: "Token estimation, per-model cost, and session statistics aggregation shared by Host and Client." },
  "@lfaa/rules": { en: "Layered prompts: system rules, project rules (AGENTS.md / .lfaa/rules.md), and user-global rules." },
  "@lfaa/session": { en: "Session domain types, on-disk session files, titles, and historical summaries." },
  "@lfaa/settings": { en: "Persistent general and coding settings stored under the LFAA home directory." },
  "@lfaa/storage": { en: "Library layout, asset and artifact storage, and cross-directory data-root migration." },
  "@lfaa/subagent": { en: "In-process subagents: isolated context loops, read/write permission boundaries, and parallel dispatch limits." },
  "@lfaa/tools": { en: "Tool registry and execution: sandboxed workspace tools plus a registration API for plugins." },
  "@lfaa/plugins": { en: "Plugin lifecycle: install, enable, disable, uninstall via Cordis Loader, with a profile-scoped record." },
  "@lfaa/skills": { en: "Skill catalogue: built-in skills, on-demand loading, Git installation, and per-project discovery." },
  "@lfaa/bash-local": { en: "Resolves the local Bash flavour (Git Bash, WSL, or native) for command execution." },
  "@lfaa/pwsh-local": { en: "Resolves PowerShell and CMD invocations for Windows command execution." },
  "@lfaa/shell": { en: "Shell process execution: invocation resolution, cancellation, and output collection." },
  "@lfaa/shell-env": { en: "Shell environment preparation, raw byte handling, and local code-page detection." },
  "@lfaa/ui-layout": { en: "Four-column shell: navigation, sidebars, context panel, and the workbench contribution service." },
  "@lfaa/ui-primitives": { en: "Shared UI atoms: modal dialog, popover card, step slider, and the common motion vocabulary." },
  "@lfaa/ui-theme": { en: "Liquid-glass theme presets, accent colours, CSS variable injection, and the appearance settings view." },
  "@lfaa/sections": { en: "User-defined sidebar sections with persisted storage and editing UI." },
  "@lfaa/workspace": { en: "Local project CRUD, directory inspection, project menus, and the right-hand workspace panes." },
  "@lfaa/bundle-web": { en: "Web assembly bundle: mounts Host capabilities and the Loader in order, then wires cross-service seams.", kind: "bundle" },
  "@lfaa/sandbox": { en: "Sandbox seam: file-effect modes, per-call policy, and fail-closed pre-execution checks.", kind: "sandbox" },
  "@lfaa/sandbox-local": { en: "Tool-layer sandbox backend: enforces write and command policy without OS-level confinement.", kind: "sandbox" },
  "@lfaa/api-gateway": { en: "API boundary: one registry that dispatches Host HTTP routes in a fixed order.", kind: "api" },
  "@lfaa/web-server": { en: "Host service: creates the Cordis context, mounts the bundle, registers HTTP APIs, and serves Vite.", kind: "host" },
};

/** 导出子路径的双语用途说明。 */
const EXPORT_PURPOSE = {
  ".": { zh: "Host 入口（默认导出插件本体）", en: "Host entry (default-exports the plugin)" },
  "./client": { zh: "浏览器入口，供 Vite 消费", en: "Browser entry consumed by Vite" },
  "./contract": { zh: "公开契约，无 Node 或 DOM 依赖", en: "Public contract with no Node or DOM dependency" },
  "./ark-plan": { zh: "方舟套餐模型路由子路径", en: "Ark plan model routing subpath" },
  "./src/*": { zh: "源码逃生口，仅供本仓工具链", en: "Source escape hatch for this repository's tooling" },
  "./package.json": { zh: "清单文件", en: "Package manifest" },
};

function discover() {
  const found = [];
  for (const group of readdirSync(PKG_ROOT)) {
    const groupDir = join(PKG_ROOT, group);
    if (!statSync(groupDir).isDirectory()) continue;
    if (existsSync(join(groupDir, "package.json"))) {
      found.push(groupDir);
      continue;
    }
    for (const child of readdirSync(groupDir)) {
      const childDir = join(groupDir, child);
      if (existsSync(join(childDir, "package.json"))) found.push(childDir);
    }
  }
  return found.map((dir) => ({
    dir,
    rel: relative(ROOT, dir).split(sep).join("/"),
    manifest: JSON.parse(readFileSync(join(dir, "package.json"), "utf8").replace(/^\uFEFF/u, "")),
  }));
}

/** 生成导出表行。 */
function exportRows(manifest, lang) {
  const exportsField = manifest.exports ?? {};
  const rows = [];
  for (const [subpath, value] of Object.entries(exportsField)) {
    const purpose = EXPORT_PURPOSE[subpath];
    const target = typeof value === "string" ? value : (value?.default ?? value?.types ?? "");
    if (!purpose) continue;
    rows.push(`| \`${subpath}\` | \`${target}\` | ${purpose[lang]} |`);
  }
  return rows;
}

/** 生成依赖列表行。 */
function dependencyRows(manifest) {
  return Object.entries(manifest.dependencies ?? {})
    .filter(([name]) => name.startsWith("@lfaa/"))
    .map(([name]) => `- \`${name}\``);
}

/**
 * 读取已有 README 的手写「Dev Note / 开发说明」段落。
 * 生成器只负责结构与导出表，人工补充的开发说明必须原样保留，否则 `pnpm sync` 会静默覆盖。
 */
function readDevNote(file, heading) {
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/u, "");
  const match = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "u").exec(text);
  const body = (match?.[1] ?? "").trim();
  return body.length > 0 ? body : null;
}

function renderEnglish(pkg, meta, devNote) {
  const { manifest, rel } = pkg;
  const deps = dependencyRows(manifest);
  const rows = exportRows(manifest, "en");
  const kindLine = meta.kind === "bundle" ? "assembly bundle" : meta.kind === "host" ? "host service package" : "package";

  return `---
description: ${JSON.stringify(meta.en)}
kind: "${meta.kind ?? "package"}"
---

# ${manifest.name}

English | [中文](README.zh.md)

## Summary

${meta.en}

This ${kindLine} lives in \`${rel}\`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
${rows.join("\n") || "| `.` | — | — |"}

## Dependencies

${deps.length > 0 ? deps.join("\n") : "No workspace dependencies."}

## Dev Note

${devNote ?? "None."}
`;
}

function renderChinese(pkg, devNote) {
  const { manifest, rel } = pkg;
  const deps = dependencyRows(manifest);
  const rows = exportRows(manifest, "zh");

  return `---
description: ${JSON.stringify(manifest.description ?? "")}
kind: "${META[manifest.name]?.kind ?? "package"}"
---

# ${manifest.name}

[English](README.md) | 中文

## 摘要

${manifest.description ?? ""}

本包位于 \`${rel}\`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
${rows.join("\n") || "| `.` | — | — |"}

## 依赖

${deps.length > 0 ? deps.join("\n") : "无 workspace 依赖。"}

## 开发说明

${devNote ?? "无。"}
`;
}

const report = [];
for (const pkg of discover()) {
  const meta = META[pkg.manifest.name];
  if (!meta) {
    report.push(`SKIP ${pkg.manifest.name}（未登记英文摘要）`);
    continue;
  }
  // 先读旧 README 的 Dev Note，再覆盖写：人工补充的说明不能丢。
  const devNoteEn = readDevNote(join(pkg.dir, "README.md"), "Dev Note");
  const devNoteZh = readDevNote(join(pkg.dir, "README.zh.md"), "开发说明");
  writeFileSync(join(pkg.dir, "README.md"), renderEnglish(pkg, meta, devNoteEn), "utf8");
  writeFileSync(join(pkg.dir, "README.zh.md"), renderChinese(pkg, devNoteZh), "utf8");
  report.push(`OK   ${pkg.manifest.name}`);
}

console.log(report.join("\n"));
console.log(`\n共处理 ${report.filter((line) => line.startsWith("OK")).length} 个包。`);

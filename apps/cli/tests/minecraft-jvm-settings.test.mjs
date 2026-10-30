/**
 * 功能：回归 Minecraft 实例 JVM 编辑区对当前实例数据的隔离与不完整响应恢复。
 * 作用：旧/不完整接口数据不能让整个实例管理页崩溃，也不能把空参数写回。
 * 关联文件：packages/client/ui-minecraft/src/MinecraftJvmSettings.tsx、MinecraftWorkspace.tsx。
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MinecraftJvmSettings } from "../../../packages/client/ui-minecraft/src/MinecraftJvmSettings.tsx";

const requireUi = createRequire(new URL("../../../packages/client/modules/package.json", import.meta.url));
const React = requireUi("react");
globalThis.React ??= React;
const { renderToStaticMarkup } = requireUi("react-dom/server");
const workspaceSource = readFileSync(new URL("../../../packages/client/ui-minecraft/src/MinecraftWorkspace.tsx", import.meta.url), "utf8");

function render(instance) {
  return renderToStaticMarkup(React.createElement(MinecraftJvmSettings, {
    instance,
    javaLabel: "节点自动管理",
    canEdit: false,
    busy: false,
    onSave: async () => false,
    onRefresh: () => {}
  }));
}

function instance(id, values = {}) {
  return {
    id,
    name: id,
    nodeId: `node-${id}`,
    nodeName: `节点-${id}`,
    nodeStatus: "online",
    storageDirectory: id,
    releaseId: "1.16.5",
    javaMajor: 17,
    javaRuntimeId: null,
    memoryMb: 4096,
    initialHeapMb: 1024,
    jvmArguments: [],
    coreType: "Paper",
    coreBuild: "1",
    executionMode: "native",
    state: "stopped",
    sandboxAvailable: false,
    sandboxStatus: "unsupported",
    eulaAcceptedAt: "2026-10-30T00:00:00.000Z",
    serverProperties: {},
    createdAt: "2026-10-30T00:00:00.000Z",
    updatedAt: "2026-10-30T00:00:00.000Z",
    ...values
  };
}

test("不完整的当前实例数据只显示保护性错误，不因缺失 jvmArguments 崩溃", () => {
  const current = instance("current-instance", { jvmArguments: undefined, initialHeapMb: undefined });
  const markup = render(current);

  assert.match(markup, /实例 JVM 数据不完整/u);
  assert.match(markup, /current-instance/u);
  assert.doesNotMatch(markup, /保存参数/u);
});

test("每次渲染使用传入实例自己的核心、Java、堆和 JVM 参数", () => {
  const current = instance("catserver-instance", {
    coreType: "CatServer",
    javaMajor: 8,
    memoryMb: 6144,
    initialHeapMb: 2048,
    jvmArguments: ["-XX:+UseG1GC"]
  });
  const markup = render(current);

  assert.match(markup, /CatServer · Java 8/u);
  assert.match(markup, /6144/u);
  assert.match(markup, /2048/u);
  assert.match(markup, /-XX:\+UseG1GC/u);
  assert.doesNotMatch(markup, /Paper · Java/u);
  assert.doesNotMatch(markup, /Paper 旧版 G1 基础项/u);
});

test("非 Paper 核心的推荐预设说明不显示 Paper 专属参数", () => {
  const current = instance("catserver-default", { coreType: "CatServer", javaMajor: 8, jvmArguments: [] });
  const markup = render(current);

  assert.match(markup, /CatServer · Java 8 的推荐预设不添加额外 GC 参数/u);
  assert.doesNotMatch(markup, /Paper 旧版 G1 基础项/u);
});

test("Paper 旧版推荐参数仍由 Paper 与 Java 版本共同决定", () => {
  const current = instance("paper-instance", {
    coreType: "Paper",
    javaMajor: 11,
    jvmArguments: ["-XX:+UseG1GC", "-XX:+ParallelRefProcEnabled", "-XX:MaxGCPauseMillis=200", "-XX:+DisableExplicitGC"]
  });
  const markup = render(current);

  assert.match(markup, /旧版 Paper · Java 11 使用适配的 G1 基础参数/u);
  assert.match(markup, /Paper · Java 11 · 节点自动管理/u);
});

test("实例路由、编辑器状态与保存请求都绑定当前实例 ID", () => {
  assert.match(workspaceSource, /instances\.find\(\(item\) => item\.id === selectedInstanceId\)/u);
  assert.match(workspaceSource, /<MinecraftJvmSettings\s+key=\{selectedInstance\.id\}\s+instance=\{selectedInstance\}/u);
  assert.match(workspaceSource, /setMinecraftInstanceJvmConfiguration\(selectedInstance\.id, value\)/u);
});

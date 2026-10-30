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
import { getMinecraftJvmPreset } from "../../../packages/util/values/src/minecraft-jvm-contract.mjs";

const requireUi = createRequire(new URL("../../../packages/client/modules/package.json", import.meta.url));
const React = requireUi("react");
globalThis.React ??= React;
const { renderToStaticMarkup } = requireUi("react-dom/server");
const workspaceSource = readFileSync(new URL("../../../packages/client/ui-minecraft/src/MinecraftWorkspace.tsx", import.meta.url), "utf8");

function render(instance, canEdit = false) {
  return renderToStaticMarkup(React.createElement(MinecraftJvmSettings, {
    instance,
    javaLabel: "节点自动管理",
    canEdit,
    busy: false,
    onSave: async () => false,
    onRefresh: () => {}
  }));
}

function instance(id, values = {}) {
  const javaMajor = values.javaMajor ?? 17;
  const coreType = values.coreType ?? "Paper";
  const memoryMb = values.memoryMb ?? 4096;
  const jvmArguments = values.jvmArguments ?? getMinecraftJvmPreset("recommended", { javaMajor, coreType, memoryMb })?.jvmArguments ?? [];
  return {
    id,
    name: id,
    nodeId: `node-${id}`,
    nodeName: `节点-${id}`,
    nodeStatus: "online",
    storageDirectory: id,
    releaseId: "1.16.5",
    javaMajor,
    javaRuntimeId: null,
    memoryMb,
    initialHeapMb: 1024,
    jvmArguments,
    jvmArgumentsConfigured: false,
    coreType,
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
    jvmArguments: ["-XX:+UseG1GC"],
    jvmArgumentsConfigured: true
  });
  const markup = render(current);

  assert.match(markup, /CatServer · Java 8/u);
  assert.match(markup, /6144/u);
  assert.match(markup, /2048/u);
  assert.match(markup, /-XX:\+UseG1GC/u);
  assert.doesNotMatch(markup, /Paper · Java/u);
  assert.doesNotMatch(markup, /Paper 旧版 G1 基础项/u);
});

test("未配置的非 Paper 核心显示并使用通用推荐参数", () => {
  const current = instance("catserver-default", { coreType: "CatServer", javaMajor: 8 });
  const markup = render(current);

  assert.match(markup, /推荐默认 · 启动时使用/u);
  assert.match(markup, /-XX:\+DisableExplicitGC/u);
  assert.match(markup, /-XX:G1ReservePercent=20/u);
  assert.match(markup, /所有 Java 核心共用 G1 调优/u);
  assert.doesNotMatch(markup, /Paper 旧版 G1 基础项/u);
});

test("Paper 推荐文案不再受 Java 版本或核心名称分支限制", () => {
  const current = instance("paper-instance", {
    coreType: "Paper",
    javaMajor: 21
  });
  const markup = render(current);

  assert.match(markup, /150 ms 停顿目标/u);
  assert.match(markup, /Paper · Java 21 · 节点自动管理/u);
  assert.doesNotMatch(markup, /默认 GC|旧版 Paper/u);
});

test("高性能预设在 Java 21 的非 Paper 核心上保持可用", () => {
  const markup = render(instance("fabric-modern", { coreType: "Fabric", javaMajor: 21 }), true);
  const highPerformanceButton = markup.match(/<button[^>]*>高性能<\/button>/u)?.[0];
  assert.ok(highPerformanceButton);
  assert.doesNotMatch(highPerformanceButton, /disabled=""/u);
  assert.doesNotMatch(markup, /仅支持 Paper|Java 8–16/u);
});

test("PocketMine 清楚说明 PHP 运行时不消费 JVM 参数", () => {
  const markup = render(instance("pocketmine", { coreType: "PocketMine", jvmArguments: [] }));
  assert.match(markup, /PocketMine 不使用 JVM/u);
  assert.match(markup, /由 PHP 运行/u);
  assert.doesNotMatch(markup, /保存参数/u);
});

test("实例路由、编辑器状态与保存请求都绑定当前实例 ID", () => {
  assert.match(workspaceSource, /instances\.find\(\(item\) => item\.id === selectedInstanceId\)/u);
  assert.match(workspaceSource, /<MinecraftJvmSettings\s+key=\{selectedInstance\.id\}\s+instance=\{selectedInstance\}/u);
  assert.match(workspaceSource, /setMinecraftInstanceJvmConfiguration\(selectedInstance\.id, value\)/u);
});

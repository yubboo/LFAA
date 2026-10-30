/** 功能：回归 Minecraft 实例 JVM 参数的预设、版本边界及禁止启动参数注入的共享合同。作用：验证控制端与 Daemon 共用的纯值校验。关联文件：packages/util/values/src/minecraft-jvm-contract.mjs。 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMinecraftJvmArguments,
  getMinecraftJvmPreset,
  parseMinecraftJvmArguments,
  resolveMinecraftJvmArguments,
  serializeMinecraftJvmArguments
} from "../../../packages/util/values/src/minecraft-jvm-contract.mjs";
import { minecraftCoreNames } from "../../../packages/games/minecraft/src/core-sources.ts";

test("推荐与高性能预设在所有 Java 核心上提供真实 G1 参数并能往返解析", () => {
  for (const coreType of minecraftCoreNames.filter(core => core !== "PocketMine")) {
    for (const javaMajor of [8, 11, 17, 21]) {
      const recommended = getMinecraftJvmPreset("recommended", { javaMajor, coreType, memoryMb: 4096 });
      const highPerformance = getMinecraftJvmPreset("high-performance", { javaMajor, coreType, memoryMb: 4096 });
      assert.ok(recommended?.jvmArguments.length, `${coreType} Java ${javaMajor} 推荐预设必须有调优参数`);
      assert.ok(highPerformance?.jvmArguments.length, `${coreType} Java ${javaMajor} 高性能预设必须有调优参数`);
      assert.ok(highPerformance.jvmArguments.indexOf("-XX:+UnlockExperimentalVMOptions") < highPerformance.jvmArguments.indexOf("-XX:G1NewSizePercent=30"));
      const parsed = parseMinecraftJvmArguments(serializeMinecraftJvmArguments(highPerformance), { javaMajor, coreType });
      assert.deepEqual(parsed, highPerformance);
    }
  }
  const preset = getMinecraftJvmPreset("high-performance", { javaMajor: 21, coreType: "Paper", memoryMb: 4096 });
  assert.ok(preset);
  const parsed = parseMinecraftJvmArguments(serializeMinecraftJvmArguments(preset), { javaMajor: 21, coreType: "Paper" });
  assert.deepEqual(parsed, preset);
  assert.ok(buildMinecraftJvmArguments(parsed, { javaMajor: 21, coreType: "Paper" }).includes("-XX:G1HeapRegionSize=8M"));
});

test("Java 21 Paper 与非 Paper 核心都获得非空通用预设", () => {
  const preset = getMinecraftJvmPreset("recommended", { javaMajor: 21, coreType: "Paper", memoryMb: 8192 });
  assert.ok(preset?.jvmArguments.includes("-XX:+DisableExplicitGC"));
  assert.ok(preset?.jvmArguments.includes("-XX:MaxGCPauseMillis=150"));
  assert.ok(getMinecraftJvmPreset("high-performance", { javaMajor: 21, coreType: "CatServer", memoryMb: 8192 }));
  assert.equal(getMinecraftJvmPreset("high-performance", { javaMajor: 21, coreType: "PocketMine", memoryMb: 8192 }), null);
});

test("未配置实例使用推荐启动参数，显式空配置和已有参数保持原样", () => {
  const context = { javaMajor: 21, coreType: "CatServer", memoryMb: 4096 };
  const recommended = getMinecraftJvmPreset("recommended", context).jvmArguments;
  assert.deepEqual(resolveMinecraftJvmArguments({ jvmArguments: [], configured: false }, context), recommended);
  assert.deepEqual(resolveMinecraftJvmArguments({ jvmArguments: [], configured: true }, context), []);
  assert.deepEqual(resolveMinecraftJvmArguments({ jvmArguments: ["-XX:+UseG1GC"], configured: false }, context), ["-XX:+UseG1GC"]);
});

test("拒绝命令注入、未登记参数、超范围堆值及不完整 G1 组合", () => {
  const context = { javaMajor: 11, coreType: "Paper" };
  for (const value of [
    "-Xms1G\n-Xmx4G\n-jar\nserver.jar",
    "-Xms1G\n-Xmx4G\n-javaagent:agent.jar",
    "-Xms1G\n-Xmx4G\n-XX:G1HeapRegionSize=3M",
    "-Xms5G\n-Xmx4G",
    "-Xms1G\n-Xmx4G\n-XX:G1NewSizePercent=30"
  ]) assert.throws(() => parseMinecraftJvmArguments(value, context));
});

test("实验性 G1 参数需要前置解锁项；PocketMine 明确拒绝 JVM 参数", () => {
  assert.throws(() => parseMinecraftJvmArguments("-Xms1G\n-Xmx4G\n-XX:+UseG1GC\n-XX:G1NewSizePercent=30", { javaMajor: 21, coreType: "Paper" }));
  assert.doesNotThrow(() => parseMinecraftJvmArguments("-Xms1G\n-Xmx4G\n-XX:+UnlockExperimentalVMOptions\n-XX:+UseG1GC\n-XX:G1NewSizePercent=30", { javaMajor: 21, coreType: "Paper" }));
  assert.throws(() => parseMinecraftJvmArguments("-Xms512M\n-Xmx2G", { javaMajor: 17, coreType: "PocketMine" }));
});

/** 功能：回归 Minecraft 实例 JVM 参数的预设、版本边界及禁止启动参数注入的共享合同。作用：验证控制端与 Daemon 共用的纯值校验。关联文件：packages/util/values/src/minecraft-jvm-contract.mjs。 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMinecraftJvmArguments,
  getMinecraftJvmPreset,
  parseMinecraftJvmArguments,
  serializeMinecraftJvmArguments
} from "../../../packages/util/values/src/minecraft-jvm-contract.mjs";

test("旧版 Paper 的推荐预设包含可识别的 G1 参数，且高性能配置能往返解析", () => {
  const preset = getMinecraftJvmPreset("high-performance", { javaMajor: 11, coreType: "Paper", memoryMb: 4096 });
  assert.ok(preset);
  const parsed = parseMinecraftJvmArguments(serializeMinecraftJvmArguments(preset), { javaMajor: 11, coreType: "Paper" });
  assert.deepEqual(parsed, preset);
  assert.ok(buildMinecraftJvmArguments(parsed, { javaMajor: 11, coreType: "Paper" }).includes("-XX:G1HeapRegionSize=8M"));
});

test("现代 Java 默认推荐不塞入旧 Paper 调优参数", () => {
  const preset = getMinecraftJvmPreset("recommended", { javaMajor: 21, coreType: "Paper", memoryMb: 8192 });
  assert.deepEqual(preset?.jvmArguments, []);
  assert.equal(getMinecraftJvmPreset("high-performance", { javaMajor: 21, coreType: "Paper", memoryMb: 8192 }), null);
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

test("拒绝 Java 17 不兼容的旧 G1 调优项和 PocketMine", () => {
  assert.throws(() => parseMinecraftJvmArguments("-Xms1G\n-Xmx4G\n-XX:+UseG1GC\n-XX:G1NewSizePercent=30", { javaMajor: 17, coreType: "Paper" }));
  assert.throws(() => parseMinecraftJvmArguments("-Xms512M\n-Xmx2G", { javaMajor: 17, coreType: "PocketMine" }));
});

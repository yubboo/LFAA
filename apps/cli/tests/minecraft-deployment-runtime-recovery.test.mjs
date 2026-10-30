/**
 * 功能：回归 Minecraft 部署向导的 Java 元数据失败恢复路径。
 * 作用：来源暂不可用时结束加载态、允许重试或交给 AI Work 核查，同时阻止未核实版本的部署。
 * 关联文件：packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../../packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx", import.meta.url), "utf8");

test("Java 元数据错误按当前请求记录并提供重试", () => {
  assert.match(source, /setRequirementErrorEntry\(\{key,message:getErrorMessage\(reason\)\}\)/u);
  assert.match(source, /message="Java 要求核验失败"[\s\S]*?重试核验/u);
  assert.match(source, /requirementLoading\?"正在核对所选核心的 Java 要求/u);
});

test("Java 元数据失败后 AI 核查入口可用，但核验中和缺少目标参数时不可重复提交", () => {
  assert.match(source, /const canHandOffRuntime=Boolean\(selectedNode&&activeCore&&version&&build&&!buildLoading&&\(requirement\|\|requirementError\)\)/u);
  assert.match(source, /onClick=\{\(\)=>onPrepareWithAi\(runtimePreparationPrompt\)\}/u);
  assert.doesNotMatch(source, /Button disabled=\{!requirement\} onClick=\{\(\)=>onPrepareWithAi/u);
});

test("服务端 Java 要求未核实前不能进入最终部署", () => {
  assert.match(source, /const runtimeRequirementReady=selectedCore\?\.launchKind==="php"\|\|Boolean\(requirement\)/u);
  assert.match(source, /const nextStepReady=step===0\?sourceReady:instanceReady&&runtimeRequirementReady/u);
  assert.match(source, /const valid = canOperate && sourceReady && instanceReady && modeNative && runtimeRequirementReady && eula/u);
});

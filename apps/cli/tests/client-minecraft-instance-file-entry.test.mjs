/*
 * 功能：回归 Minecraft 实例到文件管理器的直接入口。
 * 作用：确保使用现有账户限定的位置合同传递稳定实例 ID，由文件服务解析实际节点目录。
 * 关联文件：packages/client/ui-minecraft/src/MinecraftWorkspace.tsx、packages/client/connection/src/file-manager-location.ts、packages/api/workspace-files/src/index.ts。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const minecraftWorkspace = readFileSync(resolve(repositoryRoot, "packages/client/ui-minecraft/src/MinecraftWorkspace.tsx"), "utf8");
const fileLocationOwner = readFileSync(resolve(repositoryRoot, "packages/client/connection/src/file-manager-location.ts"), "utf8");
const instanceMount = readFileSync(resolve(repositoryRoot, "packages/api/workspace-files/src/index.ts"), "utf8");

test("Minecraft 实例卡片和概览通过实例 ID 进入其真实文件挂载", () => {
  assert.match(minecraftWorkspace, /import \{ setFileManagerLocation \} from "lfaa-client-connection\/src\/file-manager-location\.js"/u);
  assert.match(minecraftWorkspace, /function navigateToInstanceFiles\(userId: string, instanceId: string, onNavigate: \(path: string\) => void\): void/u);
  assert.match(minecraftWorkspace, /setFileManagerLocation\(userId, `\.lfaa-library\/game-instances\/\$\{encodeURIComponent\(instanceId\)\}`, getInstanceRoute\(instanceId, "overview"\)\)/u);
  assert.match(minecraftWorkspace, /onNavigate\("\/files"\)/u);
  assert.equal((minecraftWorkspace.match(/navigateToInstanceFiles\(userId, (?:overviewInstance|instance)\.id, onNavigate\)/gu) ?? []).length, 2);
  assert.match(minecraftWorkspace, /navigateToInstanceFiles\(userId, selectedInstance\.id, onNavigate\)\}>打开实例文件<\/Button>/u);
  assert.equal((minecraftWorkspace.match(/>打开实例文件<\/Button>/gu) ?? []).length, 3);
  assert.match(fileLocationOwner, /readFileManagerLocation\(userId: string\)/u);
  assert.match(instanceMount, /id: "game-instances"[\s\S]*?const \[instanceId, \.\.\.parts\] = String\(input\.path\)\.split\("\/"\)/u);
  assert.doesNotMatch(minecraftWorkspace, /setFileManagerLocation\([^\n]*releaseId/u, "the game version must not be used as a directory path");
});

test("实例文件页消费同一账户的返回路由并提供返回实例入口", () => {
  const fileManagerPage = readFileSync(resolve(repositoryRoot, "packages/client/ui-sidebar-files/src/FileManagerPage.tsx"), "utf8");
  assert.match(fileLocationOwner, /setFileManagerLocation\(userId: string, path: string, returnPath\?: string\)/u);
  assert.match(fileLocationOwner, /readFileManagerReturnPath\(userId: string\): string \| null/u);
  assert.match(fileLocationOwner, /location\.userId !== userId/u);
  assert.match(fileLocationOwner, /path\.startsWith\("\/"\)[\s\S]*?path\.startsWith\("\/\/"\)/u);
  assert.match(fileManagerPage, /readFileManagerReturnPath\(user\.id\)/u);
  assert.match(fileManagerPage, /fileEntryContext\.userId === user\.id \? fileEntryContext\.returnPath : null/u);
  assert.match(fileManagerPage, /fileEntryReturnPath \? <Button type="primary" disabled=\{busy\} onClick=\{\(\) => onNavigate\(fileEntryReturnPath\)\}>返回实例<\/Button>/u);
  assert.match(fileManagerPage, /consumeFileManagerLocation\(\)/u);
});

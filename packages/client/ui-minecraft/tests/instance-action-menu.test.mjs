import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(new URL("../src/MinecraftWorkspace.tsx", import.meta.url), "utf8");
const workspaceStyles = readFileSync(new URL("../src/MinecraftWorkspace.css", import.meta.url), "utf8");

test("instance cards keep lifecycle actions and put the three management actions behind one button", () => {
  const actions = workspaceSource.match(/<div className="minecraft-instance-card__actions">([\s\S]*?)<\/div>/u)?.[1];
  assert.ok(actions, "instance card action region exists");
  assert.match(actions, /runMinecraftInstanceAction\(instance\.id, "start"\)/u);
  assert.match(actions, /安全停止/u);
  assert.match(actions, /setManagementInstanceId\(instance\.id\)\}>管理<\/Button>/u);
  assert.doesNotMatch(actions, />管理实例<\/Button>|>打开实例文件<\/Button>|>删除实例<\/Button>/u);
});

test("management modal routes to the existing overview and file location contracts", () => {
  assert.match(workspaceSource, /className="minecraft-instance-action-modal"[\s\S]*?open=\{Boolean\(managedInstance\)\}/u);
  assert.match(workspaceSource, /setManagementInstanceId\(null\); onNavigate\(getInstanceRoute\(managedInstance\.id, "overview"\)\)/u);
  assert.match(workspaceSource, /setManagementInstanceId\(null\); navigateToInstanceFiles\(userId, managedInstance\.id, onNavigate\)/u);
  assert.match(workspaceSource, /管理实例/u);
  assert.match(workspaceSource, /打开实例文件/u);
});

test("delete remains gated and confirmed through the existing archive operation", () => {
  assert.match(workspaceSource, /Popconfirm\s+title=\{`删除“\$\{managedInstance\.name\}”？`\}[\s\S]*?onConfirm=\{\(\) => \{ setManagementInstanceId\(null\); deleteInstance\(managedInstance\); \}\}/u);
  assert.match(workspaceSource, /disabled=\{!canOperate \|\| managedInstance\.nodeStatus !== "online" \|\| busy \|\| !\["stopped", "error", "unknown"\]\.includes\(managedInstance\.state\)\}/u);
  assert.match(workspaceSource, /归档并删除/u);
});

test("management dialog actions are full-width, touch-sized and scoped to Minecraft", () => {
  assert.match(workspaceStyles, /\.minecraft-instance-action-modal \.minecraft-instance-action-modal__buttons \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(workspaceStyles, /\.minecraft-instance-action-modal__buttons > \.ant-btn \{[^}]*min-height: 44px/u);
});

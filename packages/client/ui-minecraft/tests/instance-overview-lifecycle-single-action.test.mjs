import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(new URL("../src/MinecraftWorkspace.tsx", import.meta.url), "utf8");

test("instance overview renders one lifecycle button selected by the real instance state", () => {
  const actions = workspaceSource.match(/className="minecraft-instance-hero__actions"[\s\S]*?<\/div>/u)?.[0];
  assert.ok(actions, "the instance overview action group exists");
  assert.equal((actions.match(/>启动<\/Button>/gu) ?? []).length, 1);
  assert.equal((actions.match(/>安全停止<\/Button>/gu) ?? []).length, 1);
  assert.match(actions, /\["stopped", "error"\]\.includes\(selectedInstance\.state\) \? \([\s\S]*?selectedInstanceCanStart[\s\S]*?>启动<\/Button>/u);
  assert.match(actions, /:\s*\["running", "starting"\]\.includes\(selectedInstance\.state\) \? \([\s\S]*?<Popconfirm[\s\S]*?disabled=\{!selectedInstanceCanStop\}[\s\S]*?onConfirm=\{\(\) => instanceAction\("stop"\)\}[\s\S]*?>安全停止<\/Button>/u);
  assert.match(actions, /:\s*\([\s\S]*?<Button disabled loading=\{busy\}>\{stateLabel\(selectedInstance\.state\)\}<\/Button>/u);
  assert.match(actions, /安全重启/u, "the independent restart operation remains available");
});

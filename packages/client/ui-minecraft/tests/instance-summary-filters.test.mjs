import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(new URL("../src/MinecraftWorkspace.tsx", import.meta.url), "utf8");
const workspaceStyles = readFileSync(new URL("../src/MinecraftWorkspace.css", import.meta.url), "utf8");

test("instance summary cards are keyboard-operable filters synchronized with the status selector", () => {
  assert.match(workspaceSource, /type MinecraftInstanceFilter = "all" \| "needs-review" \| MinecraftInstance\["state"\]/u);
  assert.match(workspaceSource, /<div className="minecraft-instance-summary lfaa-card-motion-list" role="group" aria-label="按实例状态筛选">\s*\{instanceSummaryCards\.map\(\(\{ filter, label, count, action \}\) => <button/u);
  assert.match(workspaceSource, /aria-pressed=\{instanceStateFilter === filter\}\s+onClick=\{\(\) => setInstanceStateFilter\(filter\)\}/u);
  assert.match(workspaceSource, /\{ value: "needs-review", label: `需核对/u);
});

test("needs-review maps only real error and unknown instances, while search remains combined", () => {
  assert.match(workspaceSource, /if \(filter === "needs-review"\) return instance\.state === "error" \|\| instance\.state === "unknown"/u);
  assert.match(workspaceSource, /instances\.filter\(\(instance\) => matchesMinecraftInstanceFilter\(instance, instanceStateFilter\)\s*&& \(!query \|\|/u);
  assert.match(workspaceSource, /action: "筛选异常或状态未确认的实例"/u);
  assert.match(workspaceSource, /\{instances\.length \|\| instanceStateFilter !== "all" \? <>/u);
});

test("summary filters have explicit selected, pointer, and keyboard-focus feedback", () => {
  assert.match(workspaceStyles, /\.minecraft-instance-summary > \.minecraft-instance-summary__item\[aria-pressed="true"\]/u);
  assert.match(workspaceStyles, /\.minecraft-instance-summary > \.minecraft-instance-summary__item:focus-visible \{[^}]*outline: 2px solid var\(--color-focus-ring\)/u);
  assert.match(workspaceStyles, /@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\.minecraft-instance-summary > \.minecraft-instance-summary__item:hover/u);
});

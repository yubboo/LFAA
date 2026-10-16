/**
 * 功能：锁定 Minecraft 实例删除导航与任务菜单的真实反馈回归。
 * 作用：避免删除操作强制切页，也避免任务路由只显示标题而丢失执行状态。
 * 关联文件：packages/client/ui-minecraft/src/MinecraftWorkspace.tsx、MinecraftWorkspace.css。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../../../packages/client/ui-minecraft/src/MinecraftWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../../packages/client/ui-minecraft/src/MinecraftWorkspace.css", import.meta.url), "utf8");
const minecraftApi = readFileSync(new URL("../../../packages/api/minecraft-controller/src/index.ts", import.meta.url), "utf8");
const taskQueue = readFileSync(new URL("../../../packages/jobs/jobs/src/minecraft-queue.ts", import.meta.url), "utf8");
const taskPage = workspace.match(/\{!selectedInstance && currentSection === "tasks" \? <>[\s\S]*?<\/> : null\}/u)?.[0] ?? "";
const taskList = workspace.slice(workspace.indexOf("function TaskList("));

test("删除实例只提交归档任务，不主动导航到任务页", () => {
  const deleteHandler = workspace.match(/const deleteInstance = \(instance: MinecraftInstance\) => \{([\s\S]*?)\n  \};/u)?.[1] ?? "";
  assert.match(deleteHandler, /submitAction\(\(\) => deleteMinecraftInstance\(instance\.id\), false\)/u);
  assert.doesNotMatch(deleteHandler, /onNavigate/u);
  assert.match(deleteHandler, /已提交/u);
});

test("Minecraft 任务菜单渲染真实快照、空/读取状态和状态计数", () => {
  assert.notEqual(taskPage, "", "任务路由应有独立内容区");
  assert.match(taskPage, /taskStatusCounts\[status\]/u);
  assert.match(taskPage, /tasksLoaded/u);
  assert.match(taskPage, /任务状态暂不可读/u);
  assert.match(taskPage, /暂无任务记录/u);
  assert.match(taskPage, /tasks=\{tasks\}/u);
});

test("任务条目显示真实执行进度、失败消息及实例归档结果", () => {
  assert.match(taskList, /task\.status === "running" \? <Progress aria-label=/u);
  assert.match(taskList, /task\.status === "failed" \? " is-failed"/u);
  assert.match(taskList, /task\.result\?\.archived === true/u);
  assert.match(taskList, /task\.payload\.instanceName/u);
});

test("任务详情呈现失败回报、节点异常日志、输入和结构化结果", () => {
  assert.match(workspace, /loadMinecraftTaskDetails\(taskId\)/u);
  assert.match(workspace, /首条异常日志/u);
  assert.match(workspace, /没有关联的错误\/标准错误日志/u);
  assert.match(workspace, /任务输入与参数/u);
  assert.match(workspace, /节点结构化结果/u);
  assert.match(workspace, /节点执行日志/u);
  assert.match(minecraftApi, /router\.get\("\/minecraft\/tasks\/:taskId", requireAuthentication/u);
  assert.match(taskQueue, /WHERE task_id = \? ORDER BY id DESC LIMIT \?/u);
});

test("管理员可单项或多选删除终态任务；接口校验整批均为终态", () => {
  assert.match(taskList, /选择全部可删除任务/u);
  assert.match(taskList, /批量删除/u);
  assert.match(taskList, /删除这条终态任务记录/u);
  assert.match(taskList, /task\.status === "succeeded" \|\| task\.status === "failed"/u);
  assert.match(workspace, /canDelete=\{canOperate\}/u);
  assert.match(minecraftApi, /router\.delete\("\/minecraft\/tasks", requireAuthentication, requireRole\("admin"\)/u);
  assert.match(taskQueue, /rows\.some\(\(row\) => row\.status !== "succeeded" && row\.status !== "failed"\)/u);
  assert.match(taskQueue, /minecraft_task_logs WHERE task_id IN/u);
});

test("任务卡片主体点击切换终态选择且不显示圆圈标记，非终态打开详情", () => {
  assert.match(taskList, /className=\{`minecraft-task-card\$\{selected \? " is-selected" : ""\}/u);
  assert.match(taskList, /const selectable = canDelete && terminal/u);
  assert.match(taskList, /aria-pressed=\{selectable \? selected : undefined\}/u);
  assert.match(taskList, /onClick=\{\(\) => selectable \? toggleSelected\(task\.id, !selected\) : onOpenDetails\?\.\(task\.id\)\}/u);
  assert.doesNotMatch(taskList, /minecraft-task-card__selection-mark/u);
  assert.doesNotMatch(taskList, /Checkbox aria-label=\{`选择任务/u);
  assert.match(styles, /\.minecraft-task-list article\.is-selected[^\n]*var\(--color-danger/u);
  assert.doesNotMatch(styles, /minecraft-task-card__selection-mark/u);
  assert.doesNotMatch(styles, /\.minecraft-task-list article:focus-within/u);
  assert.match(styles, /\.minecraft-task-list article:not\(\.is-selected\) \.minecraft-task-card__select:focus-visible[^\n]*var\(--color-focus-ring\)/u);
  assert.match(styles, /\.minecraft-task-list article \{[^\n]*display: flex[^\n]*flex-direction: column/u);
  assert.match(styles, /\.minecraft-task-actions \{[^\n]*margin-top: auto/u);
  assert.match(styles, /\.minecraft-task-actions__end \{ margin-left: auto; \}/u);
  assert.match(styles, /\.minecraft-task-selection-bar > div,[\s\S]*?\.minecraft-task-actions__end \{ display: flex; min-width: 0; flex-wrap: wrap/u);
  assert.match(taskList, /<div className="minecraft-task-actions">\s*<div className="minecraft-task-actions__start">\s*\{onOpenDetails \? <Button[\s\S]*?查看详情[\s\S]*?请求取消任务[\s\S]*?<\/div>\s*\{canDelete && terminal && onDelete \? <div className="minecraft-task-actions__end">\s*<Popconfirm/u);
  assert.match(styles, /\.minecraft-task-copy \{ display: grid; min-width: 0; gap: 7px/u);
});

test("批量选择按用户隔离并在同标签页刷新后恢复，只保留仍可删除的任务", () => {
  assert.match(workspace, /createClientPersistenceKey\("minecraft-task-selection", 1, \[userId\]\)/u);
  assert.match(workspace, /area: "local"/u);
  assert.match(workspace, /selectionPersistence\?\.read\(\)/u);
  assert.match(workspace, /selectionPersistence\.write\(validSelection\)/u);
  assert.match(workspace, /selectionPersistence\.remove\(\)/u);
  assert.match(workspace, /currentDeletableIds = tasks\.filter\(\(task\) => task\.status === "succeeded" \|\| task\.status === "failed"\)/u);
});

test("任务状态卡片和任务列表按可用容器宽度自动换列", () => {
  assert.match(styles, /\.minecraft-task-status-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*150px\),\s*1fr\)\)/u);
  assert.match(styles, /\.minecraft-task-list\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*330px\),\s*1fr\)\)/u);
  assert.match(styles, /\.minecraft-task-detail-modal \.ant-modal-body\s*\{[^}]*overflow:\s*auto/u);
  assert.match(styles, /\.minecraft-task-detail__logs\s*\{[^}]*overflow:\s*auto/u);
  assert.match(styles, /@media \(max-width: 560px\)/u);
});

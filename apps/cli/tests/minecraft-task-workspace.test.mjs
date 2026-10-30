/**
 * 功能：锁定 Minecraft 配置、实例概览、终端/日志分离、任务筛选和运维页面布局合同。
 * 作用：保全真实属性编辑、日志展示净化、生命周期入口、停服后控制台清理和响应式实例操作布局。
 * 关联文件：packages/client/ui-minecraft/src/MinecraftWorkspace.tsx、MinecraftDeploymentPanel.tsx、MinecraftWorkspace.css 与 ui-sidebar-terminal。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../../../packages/client/ui-minecraft/src/MinecraftWorkspace.tsx", import.meta.url), "utf8");
const applicationWorkspace = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../../packages/client/ui-minecraft/src/MinecraftWorkspace.css", import.meta.url), "utf8");
const deploymentPanel = readFileSync(new URL("../../../packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx", import.meta.url), "utf8");
const terminalManager = readFileSync(new URL("../../../packages/client/ui-sidebar-terminal/src/TerminalManagerProvider.tsx", import.meta.url), "utf8");
const terminalStyles = readFileSync(new URL("../../../packages/client/ui-sidebar-terminal/src/TerminalManager.css", import.meta.url), "utf8");
const terminalAdapter = readFileSync(new URL("../../../packages/host/daemon/src/terminal-process-adapter.mjs", import.meta.url), "utf8");
const daemon = readFileSync(new URL("../../../packages/host/daemon/src/daemon.mjs", import.meta.url), "utf8");
const minecraftApi = readFileSync(new URL("../../../packages/api/minecraft-controller/src/index.ts", import.meta.url), "utf8");
const taskQueue = readFileSync(new URL("../../../packages/jobs/jobs/src/minecraft-queue.ts", import.meta.url), "utf8");
const taskPage = workspace.match(/\{!selectedInstance && currentSection === "tasks" \? <>[\s\S]*?<\/> : null\}/u)?.[0] ?? "";
const taskList = workspace.slice(workspace.indexOf("function TaskList("));

test("server.properties 表单覆盖真实快照全部属性并只提交有效变更", () => {
  assert.match(workspace, /const entries = propertySnapshot\?\.entries \?\? \[\]/u);
  assert.match(workspace, /minecraftBooleanPropertyKeys\.has\(key\)/u);
  assert.match(workspace, /minecraftPropertySections\.map\(\(title\) => \(\{ title, entries: filteredEntries\.filter/u);
  assert.match(workspace, /propertyEditorState\.columns\.map\(\(column, columnIndex\)[\s\S]*?column\.map\(\(section\)[\s\S]*?section\.entries\.map\(\(entry\) =>/u);
  assert.match(workspace, /saveMinecraftServerFileProperties\(selectedInstance\.id, propertyEditorState\.changed\)/u);
  assert.match(workspace, /entry\.sensitive \? "" : entry\.value \?\? ""/u);
  assert.match(workspace, /if \(!touchedSensitiveProperties\.has\(entry\.key\)\) return \[\]/u);
  assert.match(workspace, /replacement\.length > 0 \? \[\[entry\.key, replacement\]\] : \[\[entry\.key, null\]\]/u);
  assert.match(workspace, /敏感值默认隐藏，可输入新值或移除该项/u);
  assert.match(workspace, /setTouchedSensitiveProperties\(\(current\) => new Set\(current\)\.add\(entry\.key\)\); \}\}>移除/u);
  assert.match(workspace, /配置写入任务已提交；此页会保留在编辑器中/u);
  assert.match(workspace, /显示 \{propertyEditorState\.visible\} \/ \{propertyEditorState\.total\} 项/u);
  assert.doesNotMatch(workspace, /minecraftPropertyEditors|propertyEditorState\.(editable|readonly)/u);
});

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
  assert.match(taskPage, /taskStatusFilter === status/u);
  assert.match(taskPage, /aria-pressed=\{taskStatusFilter === status\}/u);
  assert.match(taskPage, /tasks=\{visibleTasks\} selectionTasks=\{tasks\}/u);
  assert.match(taskPage, /清除筛选/u);
});

test("任务条目显示真实执行进度、失败消息及实例归档结果", () => {
  assert.match(taskList, /task\.status === "running" \? <Progress aria-label=/u);
  assert.match(taskList, /task\.status === "failed" \? " is-failed"/u);
  assert.match(taskList, /const showMessage = task\.status !== "succeeded" \|\| task\.message !== "Minecraft 任务已完成。"/u);
  assert.match(taskList, /task\.result\?\.archived === true/u);
  assert.match(taskList, /task\.payload\.instanceName/u);
});

test("任务详情呈现失败回报、节点异常日志、输入和结构化结果", () => {
  assert.match(workspace, /loadMinecraftTaskDetails\(taskId,\s*controller\.signal\)/u);
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
  assert.match(taskList, /className=\{`minecraft-task-card lfaa-card-motion\$\{selected \? " is-selected" : ""\}/u);
  assert.match(taskList, /const selectable = canDelete && terminal/u);
  assert.match(taskList, /aria-pressed=\{selectable \? selected : undefined\}/u);
  assert.match(taskList, /onClick=\{\(\) => selectable \? toggleSelected\(task\.id, !selected\) : onOpenDetails\?\.\(task\.id\)\}/u);
  assert.doesNotMatch(taskList, /minecraft-task-card__selection-mark/u);
  assert.doesNotMatch(taskList, /Checkbox aria-label=\{`选择任务/u);
  assert.match(styles, /\.minecraft-task-list article\.is-selected[^\n]*var\(--color-danger/u);
  assert.doesNotMatch(styles, /minecraft-task-card__selection-mark/u);
  assert.doesNotMatch(styles, /\.minecraft-task-list article:focus-within/u);
  assert.match(styles, /\.minecraft-task-list article:not\(\.is-selected\) \.minecraft-task-card__select:focus-visible[^\n]*var\(--color-focus-ring\)/u);
  assert.match(styles, /\.minecraft-task-list article \{[^\n]*display: grid[^\n]*grid-template-columns: minmax\(0, 1fr\) auto/u);
  assert.match(styles, /\.minecraft-task-actions \{[^\n]*grid-column: 2; grid-row: 1;[^\n]*pointer-events: auto/u);
  assert.match(styles, /\.minecraft-task-actions__end \{ margin-left: auto; \}/u);
  assert.match(styles, /@container module-center-content \(max-width: 620px\) \{[\s\S]*?\.minecraft-workspace--tasks > \.minecraft-tasks-card > \.ant-card-body > \.minecraft-task-list > \.minecraft-task-card \{ grid-template-columns: minmax\(0, 1fr\); \}/u);
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
  assert.match(workspace, /currentDeletableIds = selectionTasks\.filter\(\(task\) => task\.status === "succeeded" \|\| task\.status === "failed"\)/u);
  assert.match(workspace, /selectionTasks=\{tasks\}/u);
});

test("任务状态卡片和任务列表按可用容器宽度自动换列", () => {
  assert.match(styles, /\.minecraft-task-status-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*150px\),\s*1fr\)\)/u);
  assert.match(styles, /\.minecraft-task-list\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*330px\),\s*1fr\)\)/u);
  assert.match(styles, /\.minecraft-task-detail-modal \.ant-modal-body\s*\{[^}]*overflow:\s*auto/u);
  assert.match(styles, /\.minecraft-task-detail__logs\s*\{[^}]*overflow:\s*auto/u);
  assert.match(styles, /@media \(max-width: 560px\)/u);
  assert.match(styles, /@container module-center-content \(max-width: 260px\) \{\s*\.minecraft-workspace--tasks > \.minecraft-task-status-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/u);
  assert.match(styles, /\.minecraft-metric-card \{[^}]*background: color-mix\(in srgb, var\(--color-surface\)/u);
  assert.match(workspace, /className="minecraft-task-status-grid lfaa-card-motion-list"/u);
  assert.match(styles, /@container module-center-content \(max-width: 560px\) \{[\s\S]*?\.minecraft-config-heading > div \{ flex: 0 1 auto; \}/u);
});

test("日志从左二管理菜单进入独立页面，支持真实实例切换并兼容旧地址", () => {
  const instanceTabs = workspace.match(/<nav className="minecraft-instance-tabs"[\s\S]*?<\/nav>/u)?.[0] ?? "";
  assert.match(applicationWorkspace, /\[\["deployment", "部署"\][\s\S]*?\["files", "文件管理"\], \["logs", "日志"\]\]/u);
  assert.match(applicationWorkspace, /const minecraftLogsSection = section === "logs" \|\| section\.startsWith\("logs\/"\)/u);
  assert.match(workspace, /const standaloneLogsMatch = \/\^logs/u);
  assert.match(workspace, /const legacyLogInstanceId = detailMatch\?\.\[2\] === "logs"/u);
  assert.match(workspace, /const getLogsRoute|if \(view === "logs"\) return `\$\{minecraftRoot\}\/logs/u);
  assert.doesNotMatch(instanceTabs, /\["logs", "日志"\]/u);
  assert.match(workspace, /currentSection === "logs" \? selectedLogInstance \?/u);
  assert.match(workspace, /aria-label="选择日志实例"/u);
  assert.doesNotMatch(workspace, /<Typography\.Title level=\{4\}>服务端日志<\/Typography\.Title>/u);
  assert.match(workspace, /minecraft-instance-logs__heading"><Typography\.Text type="secondary">/u);
  assert.match(workspace, /<Modal[\s\S]*?className="minecraft-task-detail-modal"[\s\S]*?rootClassName="minecraft-task-detail-modal-root"[\s\S]*?wrapClassName="minecraft-task-detail-modal-wrap"[\s\S]*?getContainer=\{\(\) => document\.querySelector<HTMLElement>\("\.module-center"\) \?\? document\.body\}[\s\S]*?centered/u);
  assert.match(styles, /\.minecraft-task-detail-modal-root > \.ant-modal-wrap\.minecraft-task-detail-modal-wrap \{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: auto;/u);
  assert.match(styles, /\.minecraft-task-detail-modal \.ant-modal-body \{ max-height: min\(72vh, calc\(100vh - 170px\), 760px\); overflow: auto; \}/u);
  assert.match(workspace, /loadMinecraftInstanceLogs\(selectedLogInstanceId, controller\.signal\)/u);
  assert.match(workspace, /detailView, selectedLogInstanceId/u);
  assert.match(styles, /\.minecraft-workspace--logs > \.minecraft-instance-logs\.ant-card \{[^}]*flex: 1 1 0/u);
  assert.match(styles, /\.minecraft-workspace--logs > \.minecraft-page-heading > \.minecraft-page-heading__controls > \.ant-space-item:first-child > \.ant-select \{ width: 100%; max-width: 100%; \}/u);
  assert.match(workspace, /currentSection === "connectivity"\s*\?\s*""/u);
  assert.match(workspace, /该实例当前不存在或不可见/u);
  assert.match(workspace, /还没有 Minecraft 实例/u);
});

test("部署、实例与日志页压缩重复文案并保留真实运维信息", () => {
  assert.match(workspace, /function formatMinecraftLogLine\(line: string\): string/u);
  assert.ok(workspace.includes('.replace(/\\u001b\\[[0-?]*[ -/]*[@-~]/gu, ""'));
  assert.ok(workspace.includes('.replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]/gu, ""'));
  assert.match(workspace, /text: formatMinecraftLogLine\(entry\.line\)/u);
  assert.match(styles, /grid-template-columns: minmax\(260px, 1fr\) minmax\(300px, 1\.2fr\) minmax\(340px, max-content\)/u);
  assert.match(styles, /\.minecraft-workspace--logs > \.minecraft-instance-logs\.ant-card \{[^}]*flex-direction: column/u);
  assert.match(styles, /\.minecraft-workspace--logs > \.minecraft-instance-logs\.ant-card > \.ant-card-body \{[^}]*width: 100%[^}]*grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(styles, /\.minecraft-workspace--logs > \.minecraft-instance-logs\.ant-card > \.ant-card-body > \.minecraft-instance-logs__viewport \{[^}]*width: 100%/u);
  assert.match(styles, /\.minecraft-instance-card__identity \{[^}]*flex-direction: column/u);
  assert.match(styles, /@media \(max-height: 520px\)[\s\S]*?\.minecraft-instance-logs__viewport \{ min-height: 120px; \}/u);
  assert.match(deploymentPanel, /选核心与版本，设置实例并核对 EULA/u);
  assert.match(deploymentPanel, /下载包会在部署时校验/u);
  assert.doesNotMatch(deploymentPanel, /<Typography\.Text>\{coreDescriptions\[activeCore\.name\]/u);
  assert.match(workspace, /\? "新建服务器并跟踪部署。"/u);
});

test("server.properties 分组平衡填列并在窄工作区折为单列", () => {
  assert.match(styles, /\.minecraft-property-sections\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*gap:\s*clamp\(26px,\s*3cqi,\s*40px\)/u);
  assert.match(styles, /\.minecraft-property-column\s*\{[^}]*display:\s*grid[^}]*align-content:\s*start/u);
  assert.match(styles, /\.minecraft-property-column\s*>\s*\.minecraft-property-group\s*\+\s*\.minecraft-property-group\s*\{\s*margin-top:\s*26px;\s*padding-top:\s*22px;\s*border-top:\s*1px solid var\(--color-border-subtle\);/u);
  assert.ok(workspace.includes("const columns: Array<(typeof sections)[number][]> = [[], []];"));
  assert.ok(workspace.includes("columnWeights[columnIndex] = columnWeights[columnIndex]! + section.entries.length + 1;"));
  assert.match(workspace, /propertyEditorState\.columns\.map\(\(column, columnIndex\) => <div className="minecraft-property-column"/u);
  assert.match(styles, /@container module-center-content \(max-width: 760px\)\s*\{[\s\S]*?\.minecraft-property-sections\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);/u);
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?\.minecraft-property-sections \{ grid-template-columns: minmax\(0, 1fr\); \}/u);
});

test("实例概览突出真实实例信息且任务只在独立任务页展示", () => {
  assert.match(workspace, /className="minecraft-instance-overview lfaa-card-motion-list"/u);
  assert.match(workspace, /className="minecraft-instance-hero lfaa-card-motion"/u);
  assert.match(workspace, /className="minecraft-card minecraft-instance-detail-summary lfaa-card-motion"/u);
  assert.match(workspace, /src="\/backgrounds\/cherry-blossom-waterfront\.png"/u);
  assert.match(workspace, /selectedInstance\.serverProperties\.serverPort \?\? "未配置"/u);
  assert.match(workspace, /selectedInstance\.nodeName/u);
  assert.match(workspace, /selectedInstanceCanStart/u);
  assert.match(workspace, /selectedInstanceCanStop/u);
  assert.match(workspace, /selectedInstanceCanRestart/u);
  assert.match(styles, /@container module-center-content \(max-width: 760px\)[\s\S]*?minecraft-instance-hero__art \{ width: 100%; max-width: 100%; min-height: 0; height: clamp\(150px, 24cqi, 210px\); aspect-ratio: auto;/u);
  assert.doesNotMatch(workspace, /minecraft-instance-recent-tasks/u);
  assert.match(taskPage, /<TaskList/u);
});

test("Minecraft 服务端控制台复用共享 Terminal Controller 会话并附着原生 PTY", () => {
  assert.match(workspace, /TerminalManagerDock placement="minecraft"/u);
  assert.match(workspace, /detailView === "terminal"/u);
  assert.match(workspace, /standaloneLogs \? "logs"/u);
  assert.match(terminalManager, /TerminalSurface, type TerminalSurfaceHandle/u);
  assert.match(terminalManager, /inputMode="raw"/u);
  assert.match(terminalManager, /onData=\{session\.send\}/u);
  assert.match(terminalManager, /kind: "minecraft", autoStart: true/u);
  assert.match(terminalManager, /const timer = window\.setTimeout\(\(\) => \{[\s\S]*?autoStarted\.current = true;[\s\S]*?\}, 0\);\s*return \(\) => window\.clearTimeout\(timer\);/u);
  assert.match(terminalManager, /target: \{ kind: "minecraft", instanceId: instance\.id \}/u);
  assert.match(terminalManager, /const visibleSessions = instance[\s\S]*?sessions\.filter\(session => session\.kind === "minecraft"/u);
  assert.match(terminalManager, /dock\?\.placement === "bottom" \? <div className="lfaa-terminal-manager__toolbar"/u);
  assert.match(terminalManager, /label: `\$\{instance\.name\} · 控制台`/u);
  assert.match(terminalManager, /target: \{ kind: "shell" \}/u);
  assert.match(terminalManager, /registerRightPanelContent\(rightPanelContent\)/u);
  assert.match(terminalManager, /aria-label="服务器状态和快捷命令"/u);
  assert.match(terminalManager, /sender\.send\(`\$\{command\}\\r`\)/u);
  assert.match(applicationWorkspace, /import \{ TerminalManagerRightSidebar \} from "lfaa-client-ui-sidebar-terminal\/src\/index\.js"/u);
  assert.match(applicationWorkspace, /app === "minecraft" \? <TerminalManagerRightSidebar \/>/u);
  assert.match(applicationWorkspace, /app !== "minecraft" \? <section className="module-context__note"/u);
  assert.match(terminalStyles, /\.lfaa-terminal-manager__layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/u);
  assert.doesNotMatch(terminalStyles, /\.lfaa-terminal-manager--embedded \.lfaa-terminal-manager__layout[^\n]*minmax\(240px/u);
  assert.match(terminalStyles, /container: minecraft-ops \/ inline-size/u);
  assert.doesNotMatch(workspace, /sendMinecraftConsole\(instance\.id, command\)/u);
  assert.match(workspace, /setLogsInstanceId\(selectedLogInstanceId\)/u);
  assert.match(workspace, /logsInstanceId === selectedLogInstance\.id/u);
  assert.match(terminalManager, /inputEnabled=\{running && \(descriptor\.kind !== "minecraft" \|\| !minecraftInstanceState \|\| minecraftInstanceState === "running"\)\}/u);
  assert.match(terminalManager, /if \(instance\.state === "stopped"\)[\s\S]*?closeSessionTab\(existing\.id\)/u);
  assert.match(terminalManager, /instance\.state === "stopped" \? \[\] : sessions\.filter/u);
  assert.match(terminalManager, /descriptor\.kind === "minecraft" \? null : <Button[^\n]*>断开会话/u);
  assert.match(terminalManager, /instance\?\.state !== "running"\) return/u);
  assert.match(workspace, /<Button type="primary" disabled=\{!selectedInstanceCanStart\} loading=\{busy\} onClick=\{\(\) => instanceAction\("start"\)\}>启动实例/u);
  assert.match(workspace, /<Button danger disabled=\{!selectedInstanceCanStop\} loading=\{busy\}>安全停止/u);
  assert.match(workspace, /<Button disabled=\{!selectedInstanceCanRestart\} loading=\{busy\} onClick=\{\(\) => instanceAction\("restart"\)\}>安全重启/u);
  assert.match(terminalManager, /surface\.current\?\.focus\(\)/u);
  assert.match(daemon, /runtime\.consoleOutputReplay\.append\(terminalChunk\)/u);
  assert.match(daemon, /runtime\.consoleOutputReplay\?\.snapshot\(\)/u);
  assert.match(terminalAdapter, /createTerminalOutputReplayBuffer\(maximumBytes = 128 \* 1024\)/u);
  assert.doesNotMatch(terminalManager, /logSnapshot|initialOutput|__log-viewport|__snapshot/u);
  assert.match(workspace, /minecraft-workspace--instance-console/u);
  assert.match(workspace, /isInstanceConsole \? "控制台"/u);
  assert.match(workspace, /currentSection === "instances" && !selectedInstance \? <Button type="primary" onClick=\{\(\) => onNavigate\(`\$\{minecraftRoot\}\/deployment`\)\}>新建服务器/u);
  assert.match(styles, /\.minecraft-workspace--instance-console > \.minecraft-console-layout \{[^}]*flex: 1 1 0/u);
  assert.match(styles, /\.minecraft-workspace--instance-console > \.minecraft-console-layout > \.minecraft-server-terminal \{[^}]*height: auto[^}]*min-height: 0/u);
  assert.match(styles, /@media \(max-height: 520px\)[\s\S]*?\.minecraft-workspace--instance-console \{[^}]*height: auto/u);
});

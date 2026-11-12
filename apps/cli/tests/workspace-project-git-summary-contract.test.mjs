import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const host = read("../../../packages/host/git/src/git-workspace.mjs");
const controller = read("../../../packages/api/workspace-controller/src/index.ts");
const clientApi = read("../../../packages/client/connection/src/api.ts");
const workspace = read("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx");

test("Git folder summary is authenticated, project scoped, primary first, and compact", () => {
  const route = controller.slice(controller.indexOf('router.post("/workspace/projects/:projectId/git/summary"'), controller.indexOf('router.post("/workspace/projects/:projectId/git/operation"'));
  assert.match(route, /requireAuthentication/u);
  assert.match(route, /requireProjectForApp\(request\.auth!\.user\.id, request\.params\.projectId, body\.appId\)/u);
  assert.match(route, /project\.sources/u);
  assert.match(route, /folder\.position/u);
  assert.match(route, /projectForSource\(project, folder\.id\)/u);
  assert.match(route, /operation: "summary"/u);
  assert.match(route, /isPrimary: pathKey === primaryPathKey/u);
  assert.match(host, /if \(input\.operation === "summary"\)[\s\S]*?snapshotStatusSummary\(project\.root, project\.projectRelativePath/u);
  assert.match(host, /async function snapshotStatusSummary[\s\S]*?changedFileCount: changedPaths\.size[\s\S]*?insertions,[\s\S]*?deletions,[\s\S]*?unknownLineCounts/u);
  assert.doesNotMatch(host.slice(host.indexOf("async function snapshotStatusSummary"), host.indexOf("async function snapshotFileDiff")), /\bfiles\s*:|\bdiff\s*:/u);
});

test("Client loads only the active project folder summary and does not register folders while viewing", () => {
  const clientFunction = clientApi.slice(clientApi.indexOf("export function loadWorkspaceProjectGitSummary"), clientApi.indexOf("export function initializeWorkspaceGitRepository"));
  assert.match(clientFunction, /loadWorkspaceProjectGitSummary\(projectId: string, signal\?: AbortSignal\)/u);
  assert.match(clientFunction, /\/git\/summary/u);
  assert.match(clientFunction, /JSON\.stringify\(\{ appId: "workspace" \}\)/u);
  const summaryEffect = workspace.match(/useEffect\(\(\) => \{\s*const projectId = app === "workspace"[\s\S]*?loadWorkspaceProjectGitSummary\(projectId, controller\.signal\)[\s\S]*?\}, \[activeAiSession\?\.appId,[^\]]*workspaceProjectsRevision[^\]]*\]\);/u)?.[0] ?? "";
  assert.ok(summaryEffect);
  assert.match(summaryEffect, /activeAiSession\.projectId[\s\S]*?loadWorkspaceProjectGitSummary\(projectId, controller\.signal\)/u);
  assert.doesNotMatch(summaryEffect, /loadAgentGitRepositories|registerAgentGitRepository|loadAgentGitStatus/u);
  assert.match(workspace, /registerAgentGitRepository\(folder\.path, title\)/u);
});

test("Reopening a loaded project Git summary reuses its snapshot until its account, project, or refresh revision changes", () => {
  const summaryEffect = workspace.match(/useEffect\(\(\) => \{\s*const projectId = app === "workspace"[\s\S]*?loadWorkspaceProjectGitSummary\(projectId, controller\.signal\)[\s\S]*?\}, \[activeAiSession\?\.appId,[^\]]*workspaceProjectsRevision[^\]]*\]\);/u)?.[0] ?? "";
  const cacheGuard = summaryEffect.match(/if \(cachedSnapshot\?\.key === workspaceGitSummaryCacheKey && cachedSnapshot\.revision === gitRefreshRevision\) \{[\s\S]*?\}/u)?.[0] ?? "";
  assert.ok(summaryEffect, "摘要应有一个明确的项目摘要加载 effect");
  assert.ok(/const workspaceGitSummaryCacheRef = useRef/u.test(workspace), "成功快照应留在当前工作区组件生命周期内");
  assert.ok(/useEffect\(\(\) => \{\s*workspaceGitSummaryCacheRef\.current = null;\s*\}, \[app, userId\]\)/u.test(workspace), "切换账户或 App 时应清空旧快照");
  assert.ok(/const workspaceGitSummaryCacheKey = JSON\.stringify\(\[userId, app, projectId, workspaceProjectsRevision\]\)/u.test(summaryEffect), "缓存键应绑定当前账户、App、项目及已刷新项目目录版本");
  assert.ok(/if \(!gitSummaryOpen\) return;/u.test(summaryEffect), "关闭面板应保留成功快照");
  assert.ok(cacheGuard, "同一上下文和刷新版本的缓存命中必须早于再次读取");
  assert.ok(summaryEffect.indexOf(cacheGuard) < summaryEffect.indexOf("loadWorkspaceProjectGitSummary(projectId, controller.signal)"));
  assert.ok(/workspaceGitSummaryCacheRef\.current = \{ key: workspaceGitSummaryCacheKey, revision: gitRefreshRevision, summary: folders \}/u.test(summaryEffect), "只缓存当前版本的成功结果");
  assert.ok(!/\.catch\([\s\S]*?workspaceGitSummaryCacheRef\.current\s*=/u.test(summaryEffect), "失败的读取不得缓存");
  assert.ok(/return \(\) => \{ active = false; window\.clearTimeout\(timer\); controller\.abort\(\); \}/u.test(summaryEffect), "切换项目或关闭面板时应撤销请求");
  assert.ok(/userId/u.test(summaryEffect) && /workspaceProjectsRevision/u.test(summaryEffect), "账户和项目目录重新对账时应重新读取");
});

test("Session file sources open in the right workspace and the full list is a real tab", () => {
  assert.match(workspace, /aria-label=\{`查看来源文件 \$\{change\.path\}`\}[\s\S]*?openProjectFile\(projectId, change\.path, change\.sourceId\)/u);
  assert.match(workspace, /kind: "session-files", sessionId: activeAiSessionId, sessionFiles: files/u);
  assert.match(workspace, /onClick=\{openSessionFiles\}>查看全部/u);
  assert.match(workspace, /activeWorkspaceUtilityTabKind === "session-files"[\s\S]*?会话文件完整列表/u);
  assert.match(workspace, /activeWorkspaceUtilityTabKind === "session-files"[\s\S]*?openProjectFile\(projectId, change\.path, change\.sourceId\)/u);
});

test("Background process view reads real app tasks, details and cancellation from the Host Task owner", () => {
  assert.match(workspace, /loadAiHostTasks\(current\.signal\)/u);
  assert.match(workspace, /snapshot\.tasks\.filter\(task => task\.appId === app && task\.shell !== "project-files" && isAiHostTaskActive\(task\)\)/u);
  assert.match(workspace, /loadAiHostTask\(taskId, current\.signal\)/u);
  assert.match(workspace, /document\.visibilityState === "hidden"\) controller\?\.abort\(\)/u);
  assert.match(workspace, /cancelAiHostTask\(task\.id\)/u);
  assert.match(workspace, /aria-label="后台进程"/u);
  assert.match(workspace, /aria-label=\{`查看后台进程：\$\{shellLabel\}`\}/u);
  assert.match(workspace, /activeWorkspaceUtilityTabKind === "agent-host-task"[\s\S]*?运行命令[\s\S]*?进程输出/u);
  assert.match(workspace, /task\.result\.stdout[\s\S]*?task\.result\.stderr/u);
  assert.match(clientApi, /export function loadAiHostTasks\(signal\?: AbortSignal\)/u);
  assert.match(clientApi, /export function loadAiHostTask\(taskId: string, signal\?: AbortSignal\)/u);
  assert.match(clientApi, /export function cancelAiHostTask\(taskId: string\)/u);
  assert.doesNotMatch(workspace, /loadAiOffice|cancelAiRun|AiOfficeRun/u);
});

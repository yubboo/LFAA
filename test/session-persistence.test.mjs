/**
 * 文件：session-persistence.test.mjs
 * 作用：锁定刷新恢复、最近会话与统一 Session capability 的架构契约。
 * 负责：验证 Session Host 落在 LFAA_HOME、Chat/Work/Manual 共用一套 Session、左侧最近记录来自真实 Host。
 * 不负责：浏览器像素、真实磁盘权限、Provider 网络。
 * 状态归属：纯源码契约测试，无持久状态。
 * 对外接口：node --test test/session-persistence.test.mjs。
 * 关联文件：@lfaa/session、@lfaa/session-host-node、@lfaa/session-controller、@lfaa/workspace。
 * 修改注意事项：禁止退回 localStorage chatMessages 或硬编码 recentRuns。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");
const domain=read("packages/session/session/src/index.ts");
const host=read("packages/session/session-host-node/src/index.ts");
const controller=read("packages/client/workspace/src/shared/logic/useWorkspaceSessionController.ts");
const left=read("packages/client/app-shell/src/workbench/left/view/LeftSidebarRegion.tsx");
const web=read("packages/client/web/src/App.tsx");
const bundle=read("packages/bundle/web-app/src/vite.ts");
const browserClient=read("packages/client/connection/src/session-client.ts");

test("one Session capability persists all interaction modes",()=>{
  assert.match(domain,/WorkspaceSessionMode = "chat" \| "work" \| "manual"/);
  assert.match(domain,/WorkspaceSessionHost/);
  assert.match(domain,/WorkspaceProjectRecord/);
  assert.match(host,/resolveLfaaHomePaths\(\)\.state/);
  assert.match(host,/"sessions"/);
  assert.match(host,/上次运行已中断/);
  assert.doesNotMatch(host,/\.lfaa/);
});

test("workspace restores and saves through Session Host instead of volatile chat state",()=>{
  assert.match(controller,/sessionHost\.snapshot/);
  assert.match(controller,/sessionHost\.load/);
  assert.match(controller,/sessionHost\.save/);
  assert.match(controller,/createSession/);
  assert.match(controller,/selectSession/);
  assert.match(controller,/selectProject/);
  assert.match(controller,/toggleSessionPinned/);
  assert.doesNotMatch(controller,/localStorage\.setItem\([^\n]*chatMessages/);
});

test("left sidebar uses real recent sessions and web bundle owns the host controller",()=>{
  assert.doesNotMatch(left,/const recentRuns/);
  assert.match(left,/recentSessions\.map/);
  assert.match(left,/projects\.map/);
  assert.doesNotMatch(left,/aria-label="新建项目" disabled/);
  assert.match(left,/onSelectSession/);
  assert.match(web,/sessionHost=\{webWorkspaceSessionHost\}/);
  assert.match(bundle,/lfaaDevSessionBridge\(\)/);
  assert.match(browserClient,/content-type/);
  assert.match(browserClient,/Session Host 未接入当前 Web Host/);
});

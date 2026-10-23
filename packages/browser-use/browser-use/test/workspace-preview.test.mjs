import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createProjectPreviewServer } from "../../../host/project-files/src/project-files.mjs";
import { BrowserSessionManager } from "../src/session-manager.ts";

test("opens a scoped workspace preview in the same isolated Browser Session used by the Dock", async t => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const provider = manager.listProviders().find(item => item.id === "lfaa-managed-edge" && item.available)
    ?? manager.listProviders().find(item => item.id === "lfaa-managed-chrome" && item.available);
  if (!provider) {
    await manager.closeAll();
    return t.skip("当前系统没有可启动的隔离 Edge/Chrome");
  }
  const tempRoot = await mkdtemp(join(tmpdir(), "lfaa-browser-session-preview-"));
  const workspace = join(tempRoot, "workspace");
  await mkdir(workspace);
  await writeFile(join(workspace, "index.html"), "<!doctype html><title>LFAA preview regression</title><style>body{color:#123}#nickname{position:absolute;top:16px;left:16px;width:260px}#credential{position:absolute;top:320px;left:16px;width:260px}#challenge-slider{position:absolute;top:140px;left:16px;width:360px;height:48px;background:#def;touch-action:none}#page-tail{height:2400px}</style><h1>workspace preview</h1><button type=\"button\">点我</button><button type=\"button\" hidden>隐藏操作</button><input id=\"nickname\" aria-label=\"昵称\"><input id=\"credential\" type=\"password\" aria-label=\"密码\"><div id=\"challenge-slider\" role=\"slider\" aria-label=\"模拟验证码拖动\">按住并拖动</div><output id=\"result\"></output><div id=\"page-tail\"></div><script>let count=0;document.querySelector('button').addEventListener('click',()=>{count++;document.querySelector('#result').textContent='你点了 '+count+' 次'});const nickname=document.querySelector('#nickname');nickname.addEventListener('input',()=>document.querySelector('#result').textContent='输入:'+nickname.value);const slider=document.querySelector('#challenge-slider');let held=false,startX=0,lastX=0;slider.addEventListener('pointerdown',event=>{held=true;startX=event.clientX;lastX=startX});slider.addEventListener('pointermove',event=>{if(held)lastX=event.clientX});slider.addEventListener('pointerup',()=>{if(held)document.querySelector('#result').textContent='人工拖动完成:'+Math.round(lastX-startX);held=false});window.addEventListener('scroll',()=>document.querySelector('#result').textContent='滚动:'+Math.round(window.scrollY));</script>");
  const preview = await createProjectPreviewServer(workspace, "index.html");
  t.after(async () => { await manager.closeAll(); await preview.close(); await rm(tempRoot, { recursive: true, force: true }); });

  const opened = await manager.navigateProjectPreview("preview-test-owner", "preview-test-session", provider.id, preview);
  assert.equal(opened.url, preview.url);
  assert.equal(opened.title, "LFAA preview regression");
  assert.match(opened.pageText, /workspace preview/u);
  assert.match(opened.pageText, /点我/u);
  assert.ok(opened.controls.some(control => control.role === "button" && control.name === "点我"));
  assert.ok(!opened.controls.some(control => control.name.includes("隐藏操作")));
  assert.ok(opened.controls.some(control => control.name === "受保护的敏感字段" && !control.type));
  assert.ok(opened.screenshot?.dataBase64.length);

  const resized = await manager.resizeViewport("preview-test-owner", "preview-test-session", provider.id, 960, 1120);
  assert.equal(resized?.screenshot?.width, 960);
  assert.equal(resized?.screenshot?.height, 1120);
  assert.equal(resized?.pageText, "", "viewport resize returns a light snapshot and does not reread the page body");
  await assert.rejects(manager.resizeViewport("preview-test-owner", "preview-test-session", provider.id, 200, 1120), /视口尺寸/u);
  await assert.rejects(manager.resizeViewport("preview-test-owner", "preview-test-session", "tabbit-personal", 960, 1120), /由用户控制/u);

  const clicked = await manager.click("preview-test-owner", "preview-test-session", provider.id, "button", "点我");
  assert.match(clicked.pageText, /你点了 1 次/u);
  const humanClick = await manager.clickAt("preview-test-owner", "preview-test-session", provider.id, 80, 26, undefined);
  assert.ok(humanClick.screenshot?.dataBase64.length);
  const humanTyped = await manager.typeText("preview-test-owner", "preview-test-session", provider.id, "人工输入验证", undefined, false);
  assert.equal(humanTyped.screenshot, null);
  assert.match(humanTyped.pageText, /输入:人工输入验证/u);
  const challengeDrag = await manager.dragAt("preview-test-owner", "preview-test-session", provider.id, 42, 164, [
    { x: 90, y: 164, delayMs: 5 }, { x: 156, y: 164, delayMs: 8 }, { x: 236, y: 164, delayMs: 8 }, { x: 330, y: 164, delayMs: 5 }
  ]);
  assert.match(challengeDrag.pageText, /人工拖动完成:288/u);
  await manager.clickAt("preview-test-owner", "preview-test-session", provider.id, 80, 330);
  const manualCredential = await manager.typeText("preview-test-owner", "preview-test-session", provider.id, "human-only-secret", undefined, false);
  assert.ok(!JSON.stringify(manualCredential).includes("human-only-secret"), "human-entered secrets must not be returned in the browser snapshot");
  await assert.rejects(manager.fill("preview-test-owner", "preview-test-session", provider.id, "密码", "secret"), /由用户/u);
  await manager.clickAt("preview-test-owner", "preview-test-session", provider.id, 80, 26);
  await manager.pressKey("preview-test-owner", "preview-test-session", provider.id, "Control+A", undefined, false);
  const replaced = await manager.typeText("preview-test-owner", "preview-test-session", provider.id, "替换完成", undefined, false);
  assert.match(replaced.pageText, /输入:替换完成/u);
  await assert.rejects(manager.pressKey("preview-test-owner", "preview-test-session", provider.id, "Control+W"), /允许列表/u);
  const scrolled = await manager.scroll("preview-test-owner", "preview-test-session", provider.id, "down", 450, undefined, false);
  assert.equal(scrolled.screenshot, null);
  await new Promise(resolve => setTimeout(resolve, 100));
  const afterScroll = await manager.getPanelSnapshot("preview-test-owner", "preview-test-session", provider.id, false);
  assert.match(afterScroll?.pageText ?? "", /滚动:[1-9]\d*/u);
  const refreshed = await manager.getPanelSnapshot("preview-test-owner", "preview-test-session", provider.id, true);
  assert.ok(refreshed?.screenshot?.dataBase64.length);
  const dockSnapshot = await manager.getPanelSnapshot("preview-test-owner", "preview-test-session", provider.id);
  assert.equal(dockSnapshot?.sessionId, opened.sessionId);
  assert.equal(dockSnapshot?.url, preview.url);
  assert.match(dockSnapshot?.pageText ?? "", /滚动:450/u);
});

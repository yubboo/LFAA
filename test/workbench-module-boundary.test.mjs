/**
 * #21.23 全域 Workbench 模块边界门禁。
 * 锁定 DeepSeek-Harness 风格：模块目录 + public index + local CSS Module + controller/service owner。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const read=(relative)=>fs.readFileSync(path.join(root,relative),"utf8");
const exists=(relative)=>fs.existsSync(path.join(root,relative));

const modules=[
  ["left","packages/app-shell/src/workbench/left/index.ts","packages/app-shell/src/workbench/left/LeftSidebar.module.css"],
  ["center","packages/app-shell/src/workbench/center/index.ts","packages/app-shell/src/workbench/center/CenterWorkspace.module.css"],
  ["center/header","packages/app-shell/src/workbench/center/header/index.ts","packages/app-shell/src/workbench/center/header/CenterHeader.module.css"],
  ["center/conversation","packages/app-shell/src/workbench/center/conversation/index.ts","packages/app-shell/src/workbench/center/conversation/Conversation.module.css"],
  ["center/composer","packages/app-shell/src/workbench/center/composer/index.ts","packages/app-shell/src/workbench/center/composer/Composer.module.css"],
  ["center/composer/runtime-control","packages/app-shell/src/workbench/center/composer/runtime-control/index.ts","packages/app-shell/src/workbench/center/composer/runtime-control/RuntimeControl.module.css"],
  ["right","packages/app-shell/src/workbench/right/index.ts","packages/app-shell/src/workbench/right/RightSidebar.module.css"],
  ["terminal","packages/app-shell/src/workbench/terminal/index.ts","packages/app-shell/src/workbench/terminal/BottomTerminal.module.css"],
  ["shell","packages/app-shell/src/workbench/shell/index.ts","packages/app-shell/src/workbench/shell/WorkbenchShell.module.css"],
  ["settings","packages/app-shell/src/workbench/settings/index.ts","packages/app-shell/src/workbench/settings/SettingsSurface.module.css"],
  ["session","packages/app-shell/src/workbench/session/index.ts",null],
  ["shared","packages/app-shell/src/workbench/shared/index.ts","packages/app-shell/src/workbench/shared/IconButton.module.css"],
];

test("all workbench parent/child modules have a public boundary",()=>{
  for(const [name,index,css] of modules){assert.equal(exists(index),true,`${name} missing public index.ts`);if(css)assert.equal(exists(css),true,`${name} missing local CSS Module`);}
});

test("AgentWorkbench is a thin composition root",()=>{
  const source=read("packages/app-shell/src/AgentWorkbench.tsx");
  assert.ok(source.split(/\r?\n/).length<=160,"AgentWorkbench grew back into a monolith");
  for(const forbidden of ["buildAiProviderViews","mapPluginInspection","ResizeObserver","agentRuntimeHost.subscribe","<SettingsPage","<UserMenu","<ThemeModeMenu",'className="agent-']) assert.equal(source.includes(forbidden),false,`composition root owns forbidden implementation: ${forbidden}`);
  for(const required of ["useWorkbenchThemeController","useWorkbenchChromeController","useAiSettingsController","usePluginSettingsController","useAgentSessionController","<WorkbenchShell","<SettingsSurface"]) assert.equal(source.includes(required),true,`composition root missing ${required}`);
});

test("global app-shell CSS is reset-only and cannot style workbench modules",()=>{
  const css=read("packages/app-shell/src/agent-workbench.css");
  assert.ok(css.split(/\r?\n/).length<=40,"global stylesheet grew beyond reset scope");
  assert.doesNotMatch(css,/^\s*\.agent-/m);
  assert.doesNotMatch(css,/:global\(/);
  for(const moduleCss of fs.readdirSync(path.join(root,"packages/app-shell/src/workbench"),{recursive:true}).filter((name)=>typeof name==="string"&&name.endsWith(".module.css"))){
    const source=read(path.posix.join("packages/app-shell/src/workbench",moduleCss.replaceAll("\\","/")));
    assert.doesNotMatch(source,/:global\(/,`${moduleCss} contains :global escape`);
    assert.doesNotMatch(source,/\.agent-[\w-]+/,`${moduleCss} reaches legacy global agent classes`);
  }
});

test("Center is a parent-only composition of public child modules",()=>{
  const source=read("packages/app-shell/src/workbench/center/CenterWorkspaceRegion.tsx");
  assert.equal(source.includes("useState("),false);
  for(const token of ['from "./header"','from "./conversation"','from "./composer"',"<CenterHeader","<ConversationRegion","<ComposerRegion"]) assert.equal(source.includes(token),true,`center missing ${token}`);
  assert.doesNotMatch(source,/from "\.\/header\//);
  assert.doesNotMatch(source,/from "\.\/conversation\//);
  assert.doesNotMatch(source,/from "\.\/composer\//);
});

test("Composer owns RuntimeControl through its public entry only",()=>{
  const composer=read("packages/app-shell/src/workbench/center/composer/ComposerRegion.tsx");
  assert.match(composer,/from "\.\/runtime-control"/);
  assert.doesNotMatch(composer,/from "\.\/runtime-control\//);
  assert.match(composer,/<RuntimeControl/);
  for(const sibling of ["left/","right/","terminal/","conversation/"]) assert.equal(composer.includes(sibling),false,`Composer deep-links sibling ${sibling}`);
});

test("shell/settings/session own their state instead of AgentWorkbench",()=>{
  const shell=read("packages/app-shell/src/workbench/shell/useWorkbenchChromeController.ts");
  const theme=read("packages/app-shell/src/workbench/shell/useWorkbenchThemeController.ts");
  const settings=read("packages/app-shell/src/workbench/settings/useAiSettingsController.ts");
  const plugins=read("packages/app-shell/src/workbench/settings/usePluginSettingsController.ts");
  const session=read("packages/app-shell/src/workbench/session/useAgentSessionController.ts");
  assert.match(shell,/ResizeObserver/); assert.match(shell,/leftPaneWidth/); assert.match(shell,/ChromeState/);
  assert.match(theme,/prefers-color-scheme: dark/);
  assert.match(settings,/buildAiProviderViews/); assert.match(settings,/activeModelBinding/);
  assert.match(plugins,/Plugin Manager/);
  assert.match(session,/agentRuntimeHost|runtimeHost/); assert.match(session,/assistant\.completed/); assert.match(session,/startAgentRun/);
});

test("feature modules import sibling/ancestor features only through public index",()=>{
  const files=[];
  const walk=(dir)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.tsx?$/.test(entry.name))files.push(p);}};
  walk(path.join(root,"packages/app-shell/src/workbench"));
  for(const file of files){const source=fs.readFileSync(file,"utf8");const rel=path.relative(root,file).replaceAll("\\","/");
    if(rel.includes("/shared/")||rel.endsWith("contracts.ts")||rel.endsWith("reasoning-control.ts")||rel.endsWith("runtime-control-dependencies.ts"))continue;
    assert.doesNotMatch(source,/from ["'][^"']*\/(left|right|terminal|settings|session)\/[A-Z][^"']*["']/,`${rel} deep-links a feature implementation`);
  }
});

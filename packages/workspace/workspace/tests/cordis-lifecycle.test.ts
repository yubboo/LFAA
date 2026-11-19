// 验证四栏契约、Host 服务注册、项目目录解析与持久化的 Cordis 生命周期。
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { Context } from "@deepseek-ai/cordis";
import { WORKBENCH_REGIONS } from "@lfaa/ui-layout";
import { workspacePlugin } from "../src/index";
import { buildFolderPickerPowerShell } from "../src/system-paths";

// 在 Node 测试环境桩代 CSS Modules，使含样式导入的 Client TSX 模块可直接运行生命周期测试。
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default new Proxy({}, { get: (_, k) => String(k) });",
      };
    }
    return nextLoad(url, context);
  },
});

test("WORKBENCH_REGIONS 包含完整四栏区域", () => {
  assert.deepEqual([...WORKBENCH_REGIONS], [
    "primary-navigation",
    "section-navigation",
    "workspace",
    "context-panel",
  ]);
});

test("Host workspacePlugin 在无 DOM 环境下注册 workspace 服务并随 dispose 清理", async () => {
  const ctx = new Context();
  const fiber = ctx.plugin(workspacePlugin);
  await fiber;

  assert.equal(ctx.workspace.getStorageMode(), "host-fs");

  await fiber.dispose();
  assert.equal((ctx as { workspace?: unknown }).workspace, undefined);
});

test("Host workspacePlugin 在确认后使用默认同名目录并保留文件", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-ws-test-"));
  const documentsDir = path.join(tempRoot, "Documents");
  const storeFilePath = path.join(tempRoot, "projects.json");
  const externalFolder = path.join(tempRoot, "existing-project");
  await fs.mkdir(externalFolder, { recursive: true });
  await fs.writeFile(path.join(externalFolder, "README.md"), "# test\n", "utf8");
  await fs.mkdir(path.join(externalFolder, "src"), { recursive: true });

  const ctx = new Context();
  const fiber = ctx.plugin(workspacePlugin, {
    storeFilePath,
    documentsDir,
    folderPicker: async () => ({ cancelled: false, path: externalFolder }),
  });
  await fiber;

  try {
    const firstPath = await ctx.workspace.resolveDefaultProjectPath("app1");
    assert.equal(firstPath.documentsDir, documentsDir);
    assert.equal(firstPath.folderName, "app1");
    assert.equal(firstPath.targetPath, path.join(documentsDir, "lfaa", "app1"));

    await assert.rejects(
      () => ctx.workspace.createProject({ name: "app1", trusted: false }),
      /信任/
    );

    const createdDefault = await ctx.workspace.createProject({
      name: "app1",
      trusted: true,
    });
    assert.equal(createdDefault.rootPath, path.join(documentsDir, "lfaa", "app1"));
    assert.equal(createdDefault.trusted, true);

    const createdStat = await fs.stat(createdDefault.rootPath);
    assert.ok(createdStat.isDirectory());

    await assert.rejects(
      () => ctx.workspace.resolveDefaultProjectPath("APP1"),
      /已存在/
    );
    await assert.rejects(
      () => ctx.workspace.createProject({ name: " app1 ", rootPath: externalFolder, trusted: true }),
      /已存在/
    );

    await ctx.workspace.removeProject(createdDefault.id);
    const savedFile = path.join(createdDefault.rootPath, "existing.txt");
    await fs.writeFile(savedFile, "已有项目文件", "utf8");
    const secondPath = await ctx.workspace.resolveDefaultProjectPath("app1");
    assert.equal(secondPath.folderName, "app1");
    assert.equal(secondPath.targetPath, createdDefault.rootPath);
    const recreated = await ctx.workspace.createProject({ name: "app1", trusted: true, confirmedDefaultPath: secondPath.targetPath });
    assert.equal(recreated.rootPath, secondPath.targetPath);
    assert.equal(await fs.readFile(savedFile, "utf8"), "已有项目文件");
    await assert.rejects(fs.stat(path.join(documentsDir, "lfaa", "app1 2")), { code: "ENOENT" });

    const blocked = path.join(documentsDir, "lfaa", "blocked");
    await fs.writeFile(blocked, "保持内容", "utf8");
    await assert.rejects(() => ctx.workspace.resolveDefaultProjectPath("blocked"), /被文件或链接占用/u);
    await assert.rejects(() => ctx.workspace.createProject({ name: "blocked", trusted: true }), /被文件或链接占用/u);
    assert.equal(await fs.readFile(blocked, "utf8"), "保持内容");

    const picked = await ctx.workspace.pickLocalFolder();
    assert.deepEqual(picked, { cancelled: false, path: externalFolder });

    const validated = await ctx.workspace.validateLocalFolder(externalFolder);
    assert.deepEqual(validated, { path: externalFolder, name: "existing-project" });
    await assert.rejects(
      () => ctx.workspace.validateLocalFolder(path.join(tempRoot, "missing-dir")),
      /找不到所选文件夹/
    );

    const createdPicked = await ctx.workspace.createProject({
      name: "existing-project",
      rootPath: picked.path,
      trusted: true,
    });
    const inspection = await ctx.workspace.inspectProject(createdPicked.id);
    assert.ok(inspection);
    assert.ok(inspection.entries.some((entry) => entry.name === "src" && entry.kind === "directory"));
    assert.ok(inspection.entries.some((entry) => entry.name === "README.md" && entry.kind === "file"));

    const secondFolder = path.join(tempRoot, "extra-folder");
    await fs.mkdir(secondFolder, { recursive: true });
    await fs.writeFile(path.join(secondFolder, "EXTRA.txt"), "extra\n", "utf8");

    await assert.rejects(
      () => ctx.workspace.updateProject(createdPicked.id, { name: "APP1" }),
      /已存在/
    );

    const updated = await ctx.workspace.updateProject(createdPicked.id, {
      name: "renamed-project",
      pinned: true,
      sectionId: "sec-1",
      rootPaths: [externalFolder, secondFolder],
    });
    assert.ok(updated);
    assert.equal(updated.name, "renamed-project");
    assert.equal(updated.pinned, true);
    assert.equal(updated.sectionId, "sec-1");
    assert.equal(updated.chatCount, 0);
    assert.deepEqual(updated.rootPaths, [externalFolder, secondFolder]);

    await ctx.workspace.clearSection("sec-1");
    const clearedList = await ctx.workspace.listProjects();
    assert.equal(clearedList.find((item) => item.id === createdPicked.id)?.sectionId, null);

    await assert.rejects(
      () => ctx.workspace.updateProject(createdPicked.id, { rootPaths: [] }),
      /至少保留或添加/
    );

    const extraInspection = await ctx.workspace.inspectProject(createdPicked.id, secondFolder);
    assert.ok(extraInspection);
    assert.equal(extraInspection.rootPath, secondFolder);
    assert.ok(extraInspection.entries.some((entry) => entry.name === "EXTRA.txt" && entry.kind === "file"));

    const subInspection = await ctx.workspace.inspectProject(createdPicked.id, path.join(externalFolder, "src"));
    assert.ok(subInspection);
    assert.equal(subInspection.rootPath, path.join(externalFolder, "src"));

    const readmeData = await ctx.workspace.readProjectFile(createdPicked.id, "README.md");
    assert.ok(readmeData);
    assert.equal(readmeData.relativePath, "README.md");
    assert.ok(readmeData.content.length > 0);
    await assert.rejects(
      () => ctx.workspace.readProjectFile(createdPicked.id, "../outside.txt"),
      /超出当前项目授权目录边界/,
    );
    const revealBlocked = await ctx.workspace.revealProjectFileInExplorer(createdPicked.id, "../outside.txt");
    assert.equal(revealBlocked.opened, false);
    assert.match(revealBlocked.error ?? "", /边界/);

    const listed = await ctx.workspace.listProjects();
    assert.equal(listed.length, 2);

    const removed = await ctx.workspace.removeProject(createdPicked.id);
    assert.equal(removed, true);
    assert.equal((await ctx.workspace.listProjects()).length, 1);

    const diskStillExists = await fs.stat(externalFolder);
    assert.ok(diskStillExists.isDirectory());
  } finally {
    await fiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("Windows 原生资源管理器 IFileOpenDialog COM 脚本可编译并完成初始化", { skip: process.platform !== "win32" }, async () => {
  const execFileAsync = promisify(execFile);
  const encodedCommand = buildFolderPickerPowerShell("选择项目文件夹", true);
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-STA", "-EncodedCommand", encodedCommand],
    { timeout: 10000, windowsHide: true },
  );
  assert.equal(stdout.trim(), "COM_READY");
});

test("WorkbenchClientService 支持左二与右侧栏折叠，且 workspaceClientPlugin 卸载时清理全部贡献", async () => {
  const { WorkbenchClientService } = await import("@lfaa/ui-layout/client");
  const { workspaceClientPlugin } = await import("../client/index");
  const ctx = new Context();
  const service = new WorkbenchClientService(ctx);

  assert.equal(service.getSnapshot().leftSidebarOpen, true);
  assert.equal(service.getSnapshot().rightPanelOpen, true);

  service.toggleLeftSidebar();
  service.toggleRightPanel();
  assert.equal(service.getSnapshot().leftSidebarOpen, false);
  assert.equal(service.getSnapshot().rightPanelOpen, false);

  const clientFiber = ctx.plugin(workspaceClientPlugin);
  await clientFiber;

  const loaded = service.getSnapshot();
  assert.ok(loaded.projectProvider, "应注册 projectProvider");
  assert.ok(loaded.projectProvider?.assignProjectSection, "应注册 assignProjectSection");
  assert.ok(loaded.projectProvider?.renderProjectRowActions, "应注册 renderProjectRowActions");
  assert.ok(loaded.projectProvider?.renderProjectOverlays, "应注册 renderProjectOverlays");
  assert.ok(loaded.projectProvider?.togglePinProject, "应注册 togglePinProject");
  assert.ok(loaded.views.some((v) => v.id === "projects"), "应注册 projects 视图");
  assert.ok(loaded.contextPanels.some((p) => p.id === "workspace-context"), "应注册右侧上下文面板");

  await clientFiber.dispose();

  const unloaded = service.getSnapshot();
  assert.equal(unloaded.projectProvider, null);
  assert.equal(unloaded.views.some((v) => v.id === "projects"), false);
  assert.equal(unloaded.contextPanels.some((p) => p.id === "workspace-context"), false);
});

test("ProjectMenuStore 支持打开与关闭移出项目二次确认状态", async () => {
  const { ProjectMenuStore } = await import("../client/project-menu-store");
  const menuStore = new ProjectMenuStore();

  assert.equal(menuStore.getSnapshot().removingProjectId, null);
  menuStore.openRemoveConfirm("proj-1");
  assert.equal(menuStore.getSnapshot().removingProjectId, "proj-1");

  menuStore.closeRemoveConfirm();
  assert.equal(menuStore.getSnapshot().removingProjectId, null);
  menuStore.dispose();
});

test("LocalProjectStore 从本地缓存首屏秒开并在远端一致时静默无感校验", async () => {
  const { LocalProjectStore } = await import("../client/local-project-store");
  const cached = [{
    id: "p1",
    name: "app1",
    createdAt: 1000,
    rootPath: "G:\\app1",
    rootPaths: ["G:\\app1"],
    pinned: false,
    sectionId: null,
  }];
  const mem = new Map<string, string>([["lfaa:cache-projects", JSON.stringify(cached)]]);
  const prevWindow = (globalThis as { window?: unknown }).window;
  const prevFetch = globalThis.fetch;

  (globalThis as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
    },
  };
  globalThis.fetch = (async () => new Response(JSON.stringify({ projects: cached }), { status: 200 })) as typeof fetch;

  try {
    const store = new LocalProjectStore();
    assert.equal(store.hasLoaded(), true);
    assert.equal(store.getProjects().length, 1);
    assert.equal(store.getProjects()[0]?.name, "app1");

    let emitCount = 0;
    const unsub = store.subscribe(() => { emitCount += 1; });
    await store.refreshProjects();
    assert.equal(emitCount, 0, "数据未变化时不应重复触发 UI 重绘");
    unsub();
    store.dispose();
  } finally {
    globalThis.fetch = prevFetch;
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window: unknown }).window = prevWindow;
    }
  }
});

test("Host workspacePlugin 支持通过 defaultProjectsDirResolver 使用自定义默认新建项目目录", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-ws-resolver-"));
  const customProjectsBase = path.join(tempRoot, "my-projects");
  let currentBase = customProjectsBase;
  const ctx = new Context();
  const fiber = ctx.plugin(workspacePlugin, {
    storeFilePath: path.join(tempRoot, "projects.json"),
    defaultProjectsDirResolver: async () => currentBase,
  });
  await fiber;

  try {
    const resolved = await ctx.workspace.resolveDefaultProjectPath("demo-app");
    assert.equal(resolved.targetPath, path.join(customProjectsBase, "demo-app"));
    currentBase = path.join(tempRoot, "changed-default");
    await assert.rejects(() => ctx.workspace.createProject({
      name: "demo-app", trusted: true, confirmedDefaultPath: resolved.targetPath,
    }), /重新确认/u);
    await assert.rejects(fs.stat(currentBase), { code: "ENOENT" });
    currentBase = customProjectsBase;
    const created = await ctx.workspace.createProject({ name: "demo-app", trusted: true, confirmedDefaultPath: resolved.targetPath });
    assert.equal(created.rootPath, path.join(customProjectsBase, "demo-app"));
  } finally {
    await fiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

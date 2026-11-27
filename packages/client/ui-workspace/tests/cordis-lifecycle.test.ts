// 验证四栏契约、Host 服务注册、项目目录解析与持久化的 Cordis 生命周期。
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { Context } from "@deepseek-ai/cordis";
import { WORKBENCH_REGIONS } from "@lfaa/ui-layout";
import { workspacePlugin } from "@lfaa/workspace";
import { buildFolderPickerPowerShell } from "@lfaa/workspace";

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
    // 未填写简介时自动生成初稿，项目内新会话才能拿到范围依据。
    assert.ok(createdDefault.description?.includes("app1"));

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
    assert.match(createdPicked.description ?? "", /existing-project/u);
    assert.match(createdPicked.description ?? "", /src\//u);

    const drafted = await ctx.workspace.draftProjectBrief("自定义项目", externalFolder);
    assert.match(drafted.brief, /自定义项目/u);
    assert.ok(drafted.sources.includes("目录条目"));
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

    const described = await ctx.workspace.updateProject(createdPicked.id, { description: "只做海洋图片生成" });
    assert.equal(described?.description, "只做海洋图片生成");
    const cleared = await ctx.workspace.updateProject(createdPicked.id, { description: "" });
    assert.equal(cleared?.description, undefined);
    assert.equal((await ctx.workspace.getProject(createdPicked.id))?.description, undefined);

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

    const listed = (await ctx.workspace.listProjects()).filter((item) => !item.isDefault);
    assert.equal(listed.length, 2);

    const removed = await ctx.workspace.removeProject(createdPicked.id);
    assert.equal(removed, true);
    assert.equal((await ctx.workspace.listProjects()).filter((item) => !item.isDefault).length, 1);

    const diskStillExists = await fs.stat(externalFolder);
    assert.ok(diskStillExists.isDirectory());

    // 默认工作区是首次启动登记的真实项目：可移除，移除后不会再被自动重建。
    const defaultProject = (await ctx.workspace.listProjects()).find((item) => item.isDefault);
    assert.ok(defaultProject);
    assert.equal(await ctx.workspace.removeProject(defaultProject.id), true);
    assert.equal((await ctx.workspace.listProjects()).some((item) => item.isDefault), false);
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
  const { ProjectMenuStore } = await import("../client/store/project-menu-store");
  const menuStore = new ProjectMenuStore();

  assert.equal(menuStore.getSnapshot().removingProjectId, null);
  menuStore.openRemoveConfirm("proj-1");
  assert.equal(menuStore.getSnapshot().removingProjectId, "proj-1");

  menuStore.closeRemoveConfirm();
  assert.equal(menuStore.getSnapshot().removingProjectId, null);
  menuStore.dispose();
});

test("LocalProjectStore 从本地缓存首屏秒开并在远端一致时静默无感校验", async () => {
  const { LocalProjectStore } = await import("../client/store/local-project-store");
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
  const windowListeners = new Map<string, Set<() => void>>();
  let fetchCount = 0;

  (globalThis as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
    },
    addEventListener: (type: string, listener: () => void) => {
      const bucket = windowListeners.get(type) ?? new Set<() => void>();
      bucket.add(listener);
      windowListeners.set(type, bucket);
    },
    removeEventListener: (type: string, listener: () => void) => {
      windowListeners.get(type)?.delete(listener);
    },
  };
  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ projects: cached }), { status: 200 });
  }) as typeof fetch;

  try {
    const store = new LocalProjectStore();
    assert.equal(store.hasLoaded(), true);
    assert.equal(store.getProjects().length, 1);
    assert.equal(store.getProjects()[0]?.name, "app1");

    let emitCount = 0;
    const unsub = store.subscribe(() => { emitCount += 1; });
    await store.refreshProjects();
    assert.equal(emitCount, 0, "数据未变化时不应重复触发 UI 重绘");

    // 从资源管理器切回应用时静默刷新，用户在磁盘上删/建项目文件夹后无需手动刷新。
    const beforeFocus = fetchCount;
    for (const listener of windowListeners.get("focus") ?? []) listener();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(fetchCount, beforeFocus + 1, "窗口聚焦应触发一次静默刷新");

    unsub();
    store.dispose();
    assert.equal(windowListeners.get("focus")?.size ?? 0, 0, "dispose 时应解绑窗口事件");
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

// 负责人要求：默认项目目录（<文档>/lfaa）里手动新建的项目文件夹要被自动纳入，删掉文件夹要让项目同步消失。
test("Host workspace 与默认项目目录同步：手建文件夹自动纳入、删目录自动移出", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-ws-sync-"));
  const documentsDir = path.join(tempRoot, "Documents");
  const baseDir = path.join(documentsDir, "lfaa");
  const outsideDir = path.join(baseDir, "default-workspace");
  const handmadeDir = path.join(baseDir, "handmade");
  const worktreeContainer = path.join(baseDir, "handmade-worktrees");
  await fs.mkdir(outsideDir, { recursive: true });
  await fs.mkdir(handmadeDir, { recursive: true });
  await fs.mkdir(path.join(worktreeContainer, "00000000-feature"), { recursive: true });
  await fs.writeFile(path.join(baseDir, "notes.txt"), "文件不是项目\n", "utf8");

  const ctx = new Context();
  const fiber = ctx.plugin(workspacePlugin, { storeFilePath: path.join(tempRoot, "projects.json"), documentsDir });
  await fiber;

  try {
    // 只纳入真实子文件夹：项目外工作区、工作树容器与普通文件都跳过；默认工作区始终置顶合成。
    const initial = await ctx.workspace.listProjects();
    assert.equal(initial[0]?.isDefault, true);
    assert.deepEqual(initial.filter((item) => !item.isDefault).map((item) => item.name), ["handmade"]);
    const handmade = initial.find((item) => !item.isDefault)!;
    assert.equal(handmade.rootPath, handmadeDir);
    assert.equal(handmade.trusted, true);
    assert.equal(handmade.exists, true);

    // 用户在资源管理器里新建文件夹后，下一次刷新即被发现。
    const laterDir = path.join(baseDir, "later");
    await fs.mkdir(laterDir, { recursive: true });
    const afterCreate = await ctx.workspace.listProjects();
    assert.equal(afterCreate.filter((item) => !item.isDefault).length, 2);
    assert.ok(afterCreate.some((item) => item.rootPath === laterDir));

    // 默认项目目录之外的项目仍要用户自己绑定：磁盘删除不自动移出（既有逻辑不变）。
    const externalDir = path.join(tempRoot, "external-project");
    await fs.mkdir(externalDir, { recursive: true });
    const external = await ctx.workspace.createProject({
      name: "external-project", rootPath: externalDir, trusted: true,
    });
    await fs.rm(externalDir, { recursive: true, force: true });
    const afterExternal = await ctx.workspace.listProjects();
    assert.ok(afterExternal.some((item) => item.id === external.id && item.exists === false));

    // 删掉默认项目目录下的文件夹 → 对应项目自动移出。
    await fs.rm(laterDir, { recursive: true, force: true });
    const afterDelete = await ctx.workspace.listProjects();
    assert.equal(afterDelete.some((item) => item.rootPath === laterDir), false);
    assert.ok(afterDelete.some((item) => item.id === handmade.id));

    // 用户主动「移出」的手建项目不会被下一次刷新重新纳入。
    assert.equal(await ctx.workspace.removeProject(handmade.id), true);
    assert.equal((await ctx.workspace.listProjects()).some((item) => item.rootPath === handmadeDir), false);

    // 文件夹真的被删掉后移出记录失效：同名文件夹再建出来会重新纳入。
    await fs.rm(handmadeDir, { recursive: true, force: true });
    await ctx.workspace.listProjects();
    await fs.mkdir(handmadeDir, { recursive: true });
    const afterRecreate = await ctx.workspace.listProjects();
    assert.ok(afterRecreate.some((item) => item.rootPath === handmadeDir));
  } finally {
    await fiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("Host workspace 跳过自定义位置的项目外聊天目录", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-ws-outside-"));
  const baseDir = path.join(tempRoot, "projects-base");
  const customOutside = path.join(baseDir, "chat-tmp");
  await fs.mkdir(path.join(baseDir, "real-project"), { recursive: true });
  await fs.mkdir(customOutside, { recursive: true });
  // 旧默认位置残留的 default-workspace 同样按项目外工作区处理，不纳入项目。
  await fs.mkdir(path.join(baseDir, "default-workspace"), { recursive: true });
  const ctx = new Context();
  const fiber = ctx.plugin(workspacePlugin, {
    storeFilePath: path.join(tempRoot, "projects.json"),
    defaultProjectsDirResolver: async () => baseDir,
    outsideProjectDirResolver: async () => customOutside,
  });
  await fiber;

  try {
    const listed = (await ctx.workspace.listProjects()).filter((item) => !item.isDefault);
    assert.deepEqual(listed.map((item) => item.name), ["real-project"]);
  } finally {
    await fiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

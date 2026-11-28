// 画布项目边界、物理目录隔离与默认工作区删除单测。
// 关联：packages/workspace/workspace/src/index.ts；运行环境：Node.js（node:test）。
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { WorkspaceService } from "../src/index";

describe("WorkspaceService canvas boundary & default workspace", () => {
  it("creates canvas projects flat under lfaa/, prepares code/canvas subdirs, and supports trash/restore & default deletion", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-ws-boundary-"));
    const documentsDir = join(root, "Documents");
    const storeFilePath = join(root, "projects.json");
    const ctx = new Context();

    try {
      const service = new WorkspaceService(ctx, { documentsDir, storeFilePath });

      // 首次 listProjects 自动初始化 default-workspace 及其 code / canvas 子目录，默认项目指向 code。
      const initial = await service.listProjects();
      const defaultWs = initial.find((item) => item.isDefault);
      assert.ok(defaultWs, "should auto-register default workspace");
      const defaultRoot = join(documentsDir, "lfaa", "default-workspace");
      assert.equal(defaultWs.rootPath, join(defaultRoot, "code"));
      assert.equal(existsSync(join(defaultRoot, "code")), true);
      assert.equal(existsSync(join(defaultRoot, "canvas")), true);

      // 磁盘上已存在名为 canvas-projects 的平级目录时，应被识别为平级普通项目，而非被屏蔽的容器目录。
      const siblingDir = join(documentsDir, "lfaa", "canvas-projects");
      await mkdir(siblingDir, { recursive: true });

      // 创建画布项目应平级落在 <documentsDir>/lfaa/<name>，与 default-workspace 和 canvas-projects 平级。
      const canvasProj = await service.createProject({
        name: "霸总短剧",
        trusted: true,
        kind: "canvas",
        canvasFolderId: "folder-1",
      });
      assert.equal(canvasProj.kind, "canvas");
      assert.equal(canvasProj.canvasFolderId, "folder-1");
      assert.equal(canvasProj.rootPath, join(documentsDir, "lfaa", "霸总短剧"));
      assert.equal(existsSync(canvasProj.rootPath), true);

      const afterCreate = await service.listProjects();
      assert.equal(afterCreate.some((item) => item.name === "canvas-projects"), true);

      // 删除画布文件夹后，关联项目安全退回根目录。
      await service.clearCanvasFolder("folder-1");
      const afterClear = await service.getProject(canvasProj.id);
      assert.equal(afterClear?.canvasFolderId, null);

      // 软删除平级画布项目：移出列表且记录 dismissedPaths，syncDefaultProjectDir 不得将其误扫回为普通代码项目。
      assert.equal(await service.removeProject(canvasProj.id), true);
      assert.equal(existsSync(canvasProj.rootPath), true);
      const afterSoftRemove = await service.listProjects();
      assert.equal(afterSoftRemove.some((item) => item.id === canvasProj.id), false);
      assert.equal(afterSoftRemove.some((item) => item.rootPath === canvasProj.rootPath), false);

      // 从回收站恢复后，保留原 id 与 kind: "canvas" 且清除 dismissedPaths。
      const restored = await service.restoreProject({
        id: canvasProj.id,
        name: canvasProj.name,
        rootPath: canvasProj.rootPath,
        rootPaths: canvasProj.rootPaths,
        kind: "canvas",
        canvasFolderId: null,
      });
      assert.equal(restored.id, canvasProj.id);
      assert.equal(restored.kind, "canvas");
      const afterRestore = await service.listProjects();
      assert.equal(afterRestore.some((item) => item.id === canvasProj.id && item.kind === "canvas"), true);

      // 整删默认工作区（deleteDisk: true）：整个 default-workspace 目录消失、列表不再自动重建，且不影响平级画布项目。
      const removed = await service.removeProject(defaultWs.id, { deleteDisk: true });
      assert.equal(removed, true);
      assert.equal(existsSync(defaultRoot), false);
      assert.equal(existsSync(canvasProj.rootPath), true);

      const afterDeleteDefault = await service.listProjects();
      assert.equal(afterDeleteDefault.some((item) => item.isDefault), false);
      assert.equal(afterDeleteDefault.some((item) => item.id === canvasProj.id), true);

      // 再次重启/刷新 listProjects 仍不得复活已整删的默认工作区。
      const afterSecondReload = await service.listProjects();
      assert.equal(afterSecondReload.some((item) => item.isDefault), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("auto-creates code/canvas subdirs and migrates legacy default-workspace rootPath to code", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-ws-legacy-"));
    const documentsDir = join(root, "Documents");
    const legacyRoot = join(documentsDir, "lfaa", "default-workspace");
    const storeFilePath = join(root, "projects.json");
    const ctx = new Context();

    try {
      await mkdir(legacyRoot, { recursive: true });
      await writeFile(join(legacyRoot, "existing.txt"), "keep", "utf8");
      await writeFile(
        storeFilePath,
        JSON.stringify([
          {
            id: "default-workspace",
            name: "默认工作区",
            rootPath: legacyRoot,
            rootPaths: [legacyRoot],
            locationType: "local",
            trusted: true,
            pinned: false,
            sectionId: null,
            chatCount: 0,
            isDefault: true,
            createdAt: 1000,
          },
        ]),
        "utf8",
      );

      const service = new WorkspaceService(ctx, { documentsDir, storeFilePath });
      const listed = await service.listProjects();
      const defaultWs = listed.find((item) => item.isDefault);
      assert.ok(defaultWs);
      assert.equal(defaultWs.rootPath, join(legacyRoot, "code"));
      assert.equal(existsSync(join(legacyRoot, "code")), true);
      assert.equal(existsSync(join(legacyRoot, "canvas")), true);
      assert.equal(existsSync(join(legacyRoot, "existing.txt")), true);

      // purgeManagedCanvasProjectDir：仅允许删除已移出的默认目录下一级画布项目目录，拒绝活跃项目、默认工作区与外部目录
      const canvasProj = await service.createProject({ name: "可清理短剧", trusted: true, kind: "canvas" });
      assert.equal(await service.purgeManagedCanvasProjectDir(canvasProj.rootPath), false);
      assert.equal(existsSync(canvasProj.rootPath), true);

      assert.equal(await service.removeProject(canvasProj.id), true);
      assert.equal(await service.purgeManagedCanvasProjectDir(canvasProj.rootPath), true);
      assert.equal(existsSync(canvasProj.rootPath), false);

      assert.equal(await service.purgeManagedCanvasProjectDir(legacyRoot), false);
      assert.equal(existsSync(legacyRoot), true);
      const externalDir = join(root, "outside-dir");
      await mkdir(externalDir, { recursive: true });
      assert.equal(await service.purgeManagedCanvasProjectDir(externalDir), false);
      assert.equal(existsSync(externalDir), true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

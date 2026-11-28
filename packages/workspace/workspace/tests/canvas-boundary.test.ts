// 画布项目边界、物理目录隔离与默认工作区删除单测。
// 关联：packages/workspace/workspace/src/index.ts；运行环境：Node.js（node:test）。
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { WorkspaceService } from "../src/index";

describe("WorkspaceService canvas boundary & default workspace", () => {
  it("isolates canvas projects under canvas-projects/, clears canvas folders, and deletes default workspace on disk", async () => {
    const root = await mkdtemp(join(tmpdir(), "lfaa-ws-boundary-"));
    const documentsDir = join(root, "Documents");
    const storeFilePath = join(root, "projects.json");
    const ctx = new Context();

    try {
      const service = new WorkspaceService(ctx, { documentsDir, storeFilePath });

      // 首次 listProjects 自动初始化 default-workspace 及其 code / canvas-sample 子目录。
      const initial = await service.listProjects();
      const defaultWs = initial.find((item) => item.isDefault);
      assert.ok(defaultWs, "should auto-register default workspace");
      assert.equal(existsSync(join(defaultWs.rootPath, "code")), true);
      assert.equal(existsSync(join(defaultWs.rootPath, "canvas-sample")), true);

      // 创建画布项目应落在 <documentsDir>/lfaa/canvas-projects/<name>，且不与 default-workspace 混放。
      const canvasProj = await service.createProject({
        name: "霸总短剧",
        trusted: true,
        kind: "canvas",
        canvasFolderId: "folder-1",
      });
      assert.equal(canvasProj.kind, "canvas");
      assert.equal(canvasProj.canvasFolderId, "folder-1");
      assert.equal(canvasProj.rootPath, join(documentsDir, "lfaa", "canvas-projects", "霸总短剧"));
      assert.equal(existsSync(canvasProj.rootPath), true);

      // syncDefaultProjectDir 不得把 canvas-projects 容器目录误扫成普通代码项目。
      const afterCreate = await service.listProjects();
      assert.equal(afterCreate.some((item) => item.name === "canvas-projects"), false);

      // 删除画布文件夹后，关联项目安全退回根目录。
      await service.clearCanvasFolder("folder-1");
      const afterClear = await service.getProject(canvasProj.id);
      assert.equal(afterClear?.canvasFolderId, null);

      // 整删默认工作区（deleteDisk: true）：磁盘目录消失、列表不再自动重建，且不影响平级画布项目。
      const removed = await service.removeProject(defaultWs.id, { deleteDisk: true });
      assert.equal(removed, true);
      assert.equal(existsSync(defaultWs.rootPath), false);
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
});

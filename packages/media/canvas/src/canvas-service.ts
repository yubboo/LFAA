// Cordis 画布服务：串行保存同一画布及提交记录，生成操作在独立任务中运行。
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { type Context, Service } from "@deepseek-ai/cordis";
import type {} from "@lfaa/llm";
import type { BoardDetail, CanvasBoard } from "../contract/index";
import { CanvasRunner, snapshotRun } from "./canvas-runner";
import { CanvasStore } from "./canvas-store";
import { CanvasError, validateGraph } from "./graph";

export class CanvasService extends Service {
  static inject = ["llm"];
  readonly store: CanvasStore;
  private readonly runner: CanvasRunner;
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor(ctx: Context, config: { root?: string; mediaRoot?: string } = {}) {
    super(ctx, "canvas");
    this.store = new CanvasStore(config.root ?? join(homedir(), ".lfaa", "canvas"), config.mediaRoot);
    this.runner = new CanvasRunner(this.store, ctx.llm);
    ctx.effect(() => () => this.runner.stop());
  }

  /** 更新画布标题并递增修订号。 */
  rename(dir: string, title: string): Promise<CanvasBoard> {
    return this.serial(dir, async () => {
      const clean = title.trim();
      if (!clean || clean.length > 120) throw new CanvasError(400, "画布名称无效 / Invalid canvas title");
      const board = await this.store.board(dir);
      const updated = { ...board, title: clean, revision: board.revision + 1 };
      await this.store.saveBoard(dir, updated);
      return updated;
    });
  }

  async create(projectId: string, title: string): Promise<CanvasBoard> {
    const board: CanvasBoard = {
      schemaVersion: 1, projectId, canvasId: randomUUID(), title, revision: 0,
      nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 },
    };
    await this.store.saveBoard(this.store.boardDir(projectId, board.canvasId), board);
    return board;
  }

  async detail(dir: string): Promise<BoardDetail> {
    const board = await this.store.board(dir);
    const [assets, runs] = await Promise.all([this.store.assets(dir), this.store.runs(dir)]);
    for (const run of runs) this.runner.advance(dir, run);
    return { board, assets, runs: runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  }

  save(dir: string, expected: number, input: unknown): Promise<CanvasBoard> {
    return this.serial(dir, async () => {
      const board = await this.store.board(dir);
      if (board.revision !== expected) throw new CanvasError(409, "画布已在另一处修改 / Canvas changed in another tab");
      const graph = validateGraph(input, await this.store.assets(dir));
      const updated = { ...board, ...graph, revision: expected + 1 };
      await this.store.saveBoard(dir, updated);
      return updated;
    });
  }

  submit(dir: string, id: string, nodeId: string, revision: number) {
    return this.serial(dir, async () => {
      const existing = await this.store.run(dir, id);
      if (existing) return existing;
      const board = await this.store.board(dir);
      if (board.revision !== revision) throw new CanvasError(409, "请保存画布再运行 / Save the current graph before running");
      if ((await this.store.runs(dir)).some((run) => run.nodeId === nodeId && (run.status === "starting" || run.status === "running"))) {
        throw new CanvasError(423, "该节点已有生成任务 / Node is already running");
      }
      const run = snapshotRun(board, id, nodeId);
      await this.store.saveRun(dir, run);
      this.runner.advance(dir, run, true);
      return run;
    });
  }

  private serial<T>(key: string, action: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) ?? Promise.resolve();
    const task = previous.then(action, action);
    this.pending.set(key, task);
    return task.finally(() => {
      if (this.pending.get(key) === task) this.pending.delete(key);
    });
  }
}

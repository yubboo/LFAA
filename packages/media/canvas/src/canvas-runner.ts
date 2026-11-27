// 画布运行器复用现有模型服务，按节点版本记录实际提交输入与输出。
import { readFile } from "node:fs/promises";
import { VideoSubmissionUncertainError, type LlmService, type MediaVideoInput } from "@lfaa/llm";
import { downloadImage, resolveImagePlan } from "@lfaa/tool-media";
import type { CanvasBoard, CanvasRun } from "../contract/index";
import { CanvasStore } from "./canvas-store";
import { CanvasError } from "./graph";

export function snapshotRun(board: CanvasBoard, id: string, nodeId: string): CanvasRun {
  const node = board.nodes.find((item) => item.id === nodeId);
  if (!node || (node.kind !== "image" && node.kind !== "video")) throw new CanvasError(400, "请选择生成节点 / Select a generation node");
  const edges = board.edges.filter((edge) => edge.target === nodeId);
  const promptEdge = edges.find((edge) => edge.targetPort === "prompt");
  const promptNode = board.nodes.find((item) => item.id === promptEdge?.source);
  const prompt = [promptNode?.settings.prompt, node.settings.prompt].filter(Boolean).join("\n").trim();
  if (!prompt) throw new CanvasError(400, "请输入或连接提示词 / Add a prompt");
  const inputs = Object.fromEntries(edges.flatMap((edge) => edge.assetId ? [[edge.targetPort, edge.assetId]] : []));
  const { settings } = node;
  if (node.kind === "video" && settings.mode === "frames" && !inputs.first) throw new CanvasError(400, "请连接首帧 / Connect a first frame");
  if (node.kind === "video" && settings.mode === "reference" && !inputs.character && !inputs.motion) throw new CanvasError(400, "请连接参考图或预演视频 / Connect a reference");
  if (!settings.profileId || !settings.modelId) throw new CanvasError(400, "请选择模型 / Select a model");
  return { id, nodeId, kind: node.kind, status: "starting", createdAt: new Date().toISOString(), inputs, prompt, settings };
}

export class CanvasRunner {
  private readonly active = new Map<string, Promise<void>>();
  private readonly checkedAt = new Map<string, number>();
  private readonly startedAt = Date.now();
  private stopped = false;

  constructor(private readonly store: CanvasStore, private readonly llm: Pick<LlmService, "generateImage" | "submitVideo" | "querySubmittedVideo">) {}

  /** 已发出的请求继续保存结果，卸载后的刷新不再新建网络请求。 */
  stop(): void {
    this.stopped = true;
    this.checkedAt.clear();
  }

  advance(dir: string, run: CanvasRun, submit = false): void {
    const key = dir + run.id;
    if (this.stopped || this.active.has(key) || (!submit && Date.now() - (this.checkedAt.get(key) ?? 0) < 4500)) return;
    if (!submit && run.status !== "starting" && run.status !== "running") return;
    if (!submit && run.status === "starting" && Date.parse(run.createdAt) >= this.startedAt) return;
    this.active.set(key, this.step(dir, run, submit).catch((error: unknown) => {
      return this.store.saveRun(dir, { ...run, status: run.taskId ? "running" : error instanceof VideoSubmissionUncertainError ? "uncertain" : "failed", error: error instanceof Error ? error.message : String(error) });
    }).catch((error: unknown) => {
      process.stderr.write("画布运行状态写入失败：" + String(error) + "\n");
    }).finally(() => {
      this.active.delete(key);
      if (run.status === "running" && !this.stopped) {
        const now = Date.now();
        for (const [id, checked] of this.checkedAt) if (now - checked > 4500) this.checkedAt.delete(id);
        this.checkedAt.set(key, now);
      }
    }));
  }

  private async step(dir: string, run: CanvasRun, submit: boolean): Promise<void> {
    if (submit && run.kind === "image") {
      await this.generateImage(dir, run);
      return;
    }
    if (submit) {
      await this.submitVideo(dir, run);
      return;
    }
    if (run.status === "starting") {
      await this.store.saveRun(dir, { ...run, status: "uncertain", error: "宿主已重启，无法确认厂商是否接收 / Submission could not be verified" });
      return;
    }
    if (!run.taskId || !run.model || !run.profileId) throw new Error("视频运行记录缺少任务信息。");
    const result = await this.llm.querySubmittedVideo({ taskId: run.taskId, modelId: run.model, profileId: run.profileId });
    if (result.status === "PENDING" || result.status === "RUNNING") return;
    if (result.status !== "SUCCEEDED" || !result.videoUrl) {
      await this.store.saveRun(dir, { ...run, status: "failed", error: result.message ?? result.status });
      return;
    }
    const data = await downloadImage(result.videoUrl);
    if (!data) throw new Error("暂未能下载视频，稍后继续查询。");
    const asset = await this.store.addAsset(dir, "Video " + run.id.slice(0, 8), "", data.bytes, run.id);
    const { error: _error, ...clean } = run;
    await this.store.saveRun(dir, { ...clean, status: "succeeded", assetId: asset.id });
  }

  private async generateImage(dir: string, run: CanvasRun): Promise<void> {
    const order = ["character", "composition"];
    const references = order.flatMap((role) => run.inputs[role] ? [{ role, id: run.inputs[role]! }] : []);
    const referenceImages = await Promise.all(references.map(async ({ id }) => (await this.store.asset(dir, id)).file));
    const { ratio, modelId, profileId, seed } = run.settings;
    const size = resolveImagePlan("", ratio).size;
    const prompt = [
      run.prompt,
      ...references.map(({ role }, index) => role === "character"
        ? "第 " + (index + 1) + " 张参考图提供角色身份、发型和服装。"
        : "第 " + (index + 1) + " 张参考图提供机位、空间构图和人物位置。"),
    ].join("\n");
    const result = await this.llm.generateImage({
      prompt, referenceImages, referenceMode: "compose", ...(size ? { size } : {}), n: 1,
      ...(modelId ? { modelId } : {}), ...(profileId ? { profileId } : {}), ...(seed === undefined ? {} : { seed }),
    });
    const image = result.images[0];
    const bytes = image?.b64 ? Buffer.from(image.b64, "base64") : image?.url ? (await downloadImage(image.url))?.bytes : undefined;
    if (!bytes) throw new Error("模型未返回可保存的图片。");
    const asset = await this.store.addAsset(dir, "Image " + run.id.slice(0, 8), "", bytes, run.id);
    await this.store.saveRun(dir, { ...run, model: result.model, ...(result.profileId ? { profileId: result.profileId } : {}), status: "succeeded", assetId: asset.id });
  }

  private async submitVideo(dir: string, run: CanvasRun): Promise<void> {
    const { mode, ratio, resolution, duration, profileId, modelId, seed } = run.settings;
    const roles = { first: "first_frame", last: "last_frame", character: "reference_image", motion: "reference_video" } as const;
    const visualInputs: NonNullable<MediaVideoInput["visualInputs"]> = [];
    for (const [port, role] of Object.entries(roles)) {
      const id = run.inputs[port];
      if (!id) continue;
      const { asset, file } = await this.store.asset(dir, id);
      if (role === "reference_video" && asset.mime !== "video/mp4") throw new CanvasError(415, "运动参考需要 MP4 / Motion reference requires MP4");
      visualInputs.push({ role, url: "data:" + asset.mime + ";base64," + (await readFile(file)).toString("base64") });
    }
    if (visualInputs.reduce((count, input) => count + input.url.length, 0) > 56 * 1024 * 1024) {
      throw new CanvasError(413, "视频参考素材总大小超限 / References are too large");
    }
    const result = await this.llm.submitVideo({
      prompt: run.prompt, visualInputs, ...(mode === "frames" ? { ratio: "adaptive" } : ratio ? { ratio } : {}),
      ...(duration ? { duration } : {}), ...(resolution ? { resolution } : {}),
      ...(profileId ? { profileId } : {}), ...(modelId ? { modelId } : {}), ...(seed === undefined ? {} : { seed }),
    });
    await this.store.saveRun(dir, { ...run, ...(result.profileId ? { profileId: result.profileId } : {}), model: result.model, taskId: result.taskId, status: "running" });
  }
}

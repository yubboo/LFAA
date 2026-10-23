/** 功能：把官方 MOSS-Image 原生模型目录注册进 LFAA 本地模型核心。作用：由 LFAA Python worker 加载，不调用 ComfyUI 或远端仓库代码。 */
import { lstat, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Context } from "@deepseek-ai/cordis";
import type { SubprocessRuntime } from "lfaa-subprocess/src/index.js";
import { ensureDataDirectories, resolveDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { ManagedPythonWorker, type LocalImageRequest, type LocalImageResult, type LocalModelAdapter, type LocalModelRuntimeService } from "lfaa-llm-local-runtime/src/index.js";
import { MOSS_IMAGE_MODELS } from "./model-catalog.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaSubprocess: SubprocessRuntime;
    lfaaLocalModelRuntime: LocalModelRuntimeService;
  }
}

const workerPath = fileURLToPath(new URL("../assets/moss_image_worker.py", import.meta.url));
const workerDirectory = dirname(workerPath);
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;

function currentDataDirectory(): string {
  return projectStorage.getProjectStorageLocations().settings.contentDirectory;
}

import * as projectStorage from "lfaa-settings/src/project-storage.js";

async function createTaskDirectory(dataDirectory: string): Promise<string> {
  const paths = resolveDataPaths(dataDirectory);
  ensureDataDirectories(dataDirectory);
  const tempRoot = resolve(paths.tmp);
  const root = await realpath(tempRoot);
  if (root !== tempRoot) throw new Error("LFAA Data/tmp 必须是普通本机目录。");
  const taskDirectory = await mkdtemp(join(tempRoot, "local-image-"));
  const taskInfo = await lstat(taskDirectory);
  if (taskInfo.isSymbolicLink() || !taskInfo.isDirectory() || await realpath(taskDirectory) !== taskDirectory) {
    await rm(taskDirectory, { recursive: true, force: true });
    throw new Error("本地生图临时目录创建失败。");
  }
  return taskDirectory;
}

function isPng(bytes: Buffer): boolean {
  return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

function createAdapter(definition: typeof MOSS_IMAGE_MODELS[number], subprocess: SubprocessRuntime): LocalModelAdapter {
  const worker = new ManagedPythonWorker({ subprocess, workerPath, cwd: workerDirectory, modelId: definition.id });
  return {
    definition,
    async generateImage(modelDirectory: string, request: LocalImageRequest): Promise<LocalImageResult> {
      if (request.modelId !== definition.id) throw new Error("MOSS-Image 请求模型 ID 与目录不一致。");
      if (typeof request.prompt !== "string" || !request.prompt.trim() || request.prompt.length > 4_000) throw new Error("MOSS-Image 提示词必须为 1 至 4000 字符。");
      request.signal?.throwIfAborted();
      const dataDirectory = currentDataDirectory();
      const taskDirectory = await createTaskDirectory(dataDirectory);
      const outputPath = join(taskDirectory, "generated.png");
      try {
        const result = await worker.execute(modelDirectory, dataDirectory, { prompt: request.prompt, outputPath }, request.timeoutMs, request.unloadAfterMs, request.signal);
        if (!result.ok) throw new Error(typeof result.error === "string" ? result.error : "MOSS-Image 推理没有成功。");
        const info = await lstat(outputPath);
        if (info.isSymbolicLink() || !info.isFile() || info.size <= 0 || info.size > MAX_IMAGE_BYTES) throw new Error("MOSS-Image 输出为空、超出 16 MiB 或不是普通文件。");
        const bytes = await readFile(outputPath);
        if (bytes.byteLength !== info.size || !isPng(bytes)) throw new Error("MOSS-Image 没有返回完整 PNG 图片。");
        return { bytes, mimeType: "image/png" };
      } finally {
        await rm(taskDirectory, { recursive: true, force: true });
      }
    },
    isLoaded: () => worker.isLoaded(),
    unload: () => worker.unload()
  };
}

export const name = "lfaaMossImageAdapter";
export const inject = ["lfaaSubprocess", "lfaaLocalModelRuntime"] as const;

export function apply(ctx: Context): void {
  const disposers = MOSS_IMAGE_MODELS.map(definition => ctx.lfaaLocalModelRuntime.registerAdapter(createAdapter(definition, ctx.lfaaSubprocess)));
  ctx.effect(() => () => {
    for (const dispose of disposers) dispose();
  });
}

/** 功能：将 MiniMax-H3 原生 FL2VA 模型适配到 LFAA 本地模型核心。作用：本机受管进程生成 MP4 与原生音频，不依赖 ComfyUI。 */
import { lstat, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Context } from "@deepseek-ai/cordis";
import type { SubprocessRuntime } from "lfaa-subprocess/src/index.js";
import { ensureDataDirectories, resolveDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { ManagedPythonWorker, type LocalModelAdapter, type LocalModelRuntimeService, type LocalVideoRequest, type LocalVideoResult } from "lfaa-llm-local-runtime/src/index.js";
import { MINIMAX_H3_MODEL } from "./model-catalog.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaSubprocess: SubprocessRuntime;
    lfaaLocalModelRuntime: LocalModelRuntimeService;
  }
}

const workerPath = fileURLToPath(new URL("../assets/minimax_h3_worker.py", import.meta.url));
const workerDirectory = dirname(workerPath);
const MAX_VIDEO_BYTES = 128 * 1024 * 1024;

function currentDataDirectory(): string {
  return projectStorage.getProjectStorageLocations().settings.contentDirectory;
}

import * as projectStorage from "lfaa-settings/src/project-storage.js";

async function createTaskDirectory(dataDirectory: string): Promise<string> {
  const paths = resolveDataPaths(dataDirectory);
  ensureDataDirectories(dataDirectory);
  const tempRoot = resolve(paths.tmp);
  if (await realpath(tempRoot) !== tempRoot) throw new Error("LFAA Data/tmp 必须是普通本机目录。");
  const directory = await mkdtemp(join(tempRoot, "local-video-"));
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory() || await realpath(directory) !== directory) {
    await rm(directory, { recursive: true, force: true });
    throw new Error("MiniMax-H3 临时目录创建失败。");
  }
  return directory;
}

function isMp4(bytes: Buffer): boolean {
  return bytes.byteLength >= 16 && bytes.toString("ascii", 4, 8) === "ftyp";
}

function createAdapter(subprocess: SubprocessRuntime): LocalModelAdapter {
  const worker = new ManagedPythonWorker({ subprocess, workerPath, cwd: workerDirectory, modelId: MINIMAX_H3_MODEL.id });
  return {
    definition: MINIMAX_H3_MODEL,
    async generateVideo(modelDirectory: string, request: LocalVideoRequest): Promise<LocalVideoResult> {
      if (request.modelId !== MINIMAX_H3_MODEL.id) throw new Error("MiniMax-H3 请求模型 ID 与模型目录不一致。");
      if (!request.prompt.trim() || request.prompt.length > 5_000) throw new Error("MiniMax-H3 提示词必须为 1 至 5000 字符。");
      if (!Number.isInteger(request.durationSeconds) || request.durationSeconds < 5 || request.durationSeconds > 15) throw new Error("MiniMax-H3 原生视频时长范围为 5 至 15 秒。");
      if ((request.referenceImages?.length ?? 0) > 1) throw new Error("当前 LFAA MiniMax-H3 FL2VA 适配只接收一张首帧图；请减少角色/场景关联参考图，或切换远程 Provider。");
      request.signal?.throwIfAborted();
      const dataDirectory = currentDataDirectory();
      const taskDirectory = await createTaskDirectory(dataDirectory);
      const outputPath = join(taskDirectory, "generated.mp4");
      let inputImagePath: string | undefined;
      try {
        const image = request.referenceImages?.[0];
        if (image) {
          if (image.bytes.byteLength > 8 * 1024 * 1024) throw new Error("MiniMax-H3 首帧图片超过 8 MiB。");
          const extension = image.mimeType === "image/png" ? ".png" : image.mimeType === "image/jpeg" ? ".jpg" : ".webp";
          inputImagePath = join(taskDirectory, `first-frame${extension}`);
          await writeFile(inputImagePath, image.bytes, { flag: "wx" });
        }
        const result = await worker.execute(modelDirectory, dataDirectory, {
          prompt: request.prompt,
          durationSeconds: request.durationSeconds,
          aspectRatio: request.aspectRatio,
          outputPath,
          ...(inputImagePath ? { inputImagePath } : {})
        }, request.timeoutMs, request.unloadAfterMs, request.signal);
        if (!result.ok) throw new Error(typeof result.error === "string" ? result.error : "MiniMax-H3 推理没有成功。");
        const info = await lstat(outputPath);
        if (info.isSymbolicLink() || !info.isFile() || info.size > MAX_VIDEO_BYTES) throw new Error("MiniMax-H3 输出不是普通 MP4 文件或超过 128 MiB。");
        const bytes = await readFile(outputPath);
        if (bytes.byteLength !== info.size || !isMp4(bytes)) throw new Error("MiniMax-H3 没有返回有效 MP4 视频。");
        return { bytes, mimeType: "video/mp4" };
      } finally {
        await rm(taskDirectory, { recursive: true, force: true });
      }
    },
    isLoaded: () => worker.isLoaded(),
    unload: () => worker.unload()
  };
}

export const name = "lfaaMiniMaxH3Adapter";
export const inject = ["lfaaSubprocess", "lfaaLocalModelRuntime"] as const;

export function apply(ctx: Context): void {
  const dispose = ctx.lfaaLocalModelRuntime.registerAdapter(createAdapter(ctx.lfaaSubprocess));
  ctx.effect(() => () => dispose());
}

/** 功能：登记并识别 MiniMax-H3 原生 Diffusers FL2VA 模型目录。作用：避开原始检查点副本、Ref2VA 和远端 Python 文件。 */
import { lstat, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { LocalModelDefinition, LocalModelInspection } from "lfaa-llm-local-runtime/src/contracts.js";

const HUB = "https://huggingface.co/MiniMaxAI/MiniMax-H3";
const requiredConfigPaths = ["modular_model_index.json", "model_index.json", "transformer/config.json", "text_encoder/config.json", "tokenizer/tokenizer.json", "processor/preprocessor_config.json", "vae/config.json", "audio_vae/config.json", "scheduler/scheduler_config.json", "audio_scheduler/scheduler_config.json"];
const supportedComponents = new Set(["audio_scheduler", "audio_vae", "processor", "scheduler", "text_encoder", "tokenizer", "transformer", "vae"]);

async function safeFile(root: string, relPath: string): Promise<boolean> {
  let cursor = root;
  const parts = relPath.split("/");
  for (const part of parts.slice(0, -1)) {
    cursor = join(cursor, part);
    const directory = await lstat(cursor).catch(() => null);
    if (!directory || directory.isSymbolicLink() || !directory.isDirectory()) return false;
  }
  const info = await lstat(join(root, relPath)).catch(() => null);
  return Boolean(info && !info.isSymbolicLink() && info.isFile());
}

async function readModelIndex(path: string): Promise<Record<string, unknown> | null> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile() || info.size > 1024 * 1024) return null;
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

export async function inspectMiniMaxH3(modelDirectory: string): Promise<LocalModelInspection> {
  const root = await lstat(modelDirectory).catch(() => null);
  if (!root || root.isSymbolicLink() || !root.isDirectory() || resolve(modelDirectory) !== modelDirectory) return { ready: false, reason: "找不到 LFAA 本机模型目录。" };
  const [modularIndex, modelIndex] = await Promise.all([
    readModelIndex(join(modelDirectory, "modular_model_index.json")),
    readModelIndex(join(modelDirectory, "model_index.json"))
  ]);
  if ([modularIndex, modelIndex].some(index => index?._class_name !== "MiniMaxH3ModularPipeline" || index?._blocks_class_name !== "MiniMaxH3Blocks")) {
    return { ready: false, reason: "未识别到 MiniMax-H3 原生 Modular Diffusers FL2VA 目录。" };
  }
  const existingConfig = await Promise.all(requiredConfigPaths.map(async path => safeFile(modelDirectory, path)));
  if (existingConfig.some(exists => !exists)) return { ready: false, reason: "MiniMax-H3 FL2VA 的 transformer、text encoder、tokenizer、processor、VAE 或调度器目录不完整。" };
  for (const component of ["transformer", "text_encoder", "vae", "audio_vae"]) {
    const entries = await readdir(join(modelDirectory, component), { withFileTypes: true }).catch(() => []);
    if (!entries.some(entry => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith(".safetensors"))) {
      return { ready: false, reason: `MiniMax-H3 ${component} 目录缺少 safetensors 权重。` };
    }
  }
  return { ready: true, reason: null };
}

function includeH3NativeFiles(path: string): boolean {
  if (!path || path.includes("\\") || path.split("/").some(part => !part || part.startsWith("."))) return false;
  if (path === "LICENSE" || path === "README.md" || path === "model_index.json" || path === "modular_model_index.json") return true;
  const [component, ...parts] = path.split("/");
  if (!supportedComponents.has(component!) || !parts.length || parts.includes("..")) return false;
  if (parts.some(part => part.endsWith(".py") || part === "__pycache__")) return false;
  return /\.(?:json|safetensors|txt|model|tiktoken)$/u.test(path);
}

export const MINIMAX_H3_MODEL: LocalModelDefinition = {
  id: "minimax-h3",
  name: "MiniMax-H3 FL2VA",
  family: "MiniMax-H3",
  modality: "video",
  task: "文字/首帧生成视频与音频",
  repository: "MiniMaxAI/MiniMax-H3",
  licenseName: "MiniMax-H3 Community License",
  licenseUrl: `${HUB}/blob/main/LICENSE`,
  estimatedDownloadBytes: null,
  modelDirectory: "video/minimax-h3",
  includeFile: includeH3NativeFiles,
  inspect: inspectMiniMaxH3
};

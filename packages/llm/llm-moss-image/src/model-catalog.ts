/** 功能：识别官方 MOSS-Image Hugging Face / Diffusers 模型目录。作用：只校验原生配置与组件，不解析或执行远端模型代码。 */
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { LocalModelDefinition, LocalModelInspection } from "lfaa-llm-local-runtime/src/contracts.js";

const HUGGING_FACE = "https://huggingface.co";
const componentFiles = [
  "transformer/config.json",
  "text_encoder/config.json",
  "tokenizer/tokenizer.json",
  "vae/config.json"
] as const;

async function isSafeFile(root: string, relativePath: string): Promise<boolean> {
  let current = root;
  const parts = relativePath.split("/");
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    const info = await lstat(current).catch(() => null);
    if (!info || info.isSymbolicLink() || !info.isDirectory()) return false;
  }
  const path = join(root, relativePath);
  const info = await lstat(path).catch(() => null);
  return Boolean(info && !info.isSymbolicLink() && info.isFile() && resolve(path) === path);
}

async function readObject(path: string): Promise<Record<string, unknown> | null> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile() || info.size > 2 * 1024 * 1024) return null;
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

export async function inspectMossImageModel(modelDirectory: string): Promise<LocalModelInspection> {
  const rootInfo = await lstat(modelDirectory).catch(() => null);
  if (!rootInfo || rootInfo.isSymbolicLink() || !rootInfo.isDirectory() || resolve(modelDirectory) !== modelDirectory) {
    return { ready: false, reason: "找不到 LFAA 本机模型目录。" };
  }
  const index = await readObject(join(modelDirectory, "model_index.json"));
  if (index?._class_name !== "MOSSImagePipeline") return { ready: false, reason: "未识别到 MOSS-Image 原生 Diffusers model_index.json。" };
  const missing = await Promise.all(componentFiles.map(async path => !await isSafeFile(modelDirectory, path)));
  const safeFilesIn = async (category: string) => {
    const directory = join(modelDirectory, category);
    const info = await lstat(directory).catch(() => null);
    if (!info || info.isSymbolicLink() || !info.isDirectory()) return [] as string[];
    return (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isFile() && !entry.isSymbolicLink() && entry.name.toLowerCase().endsWith(".safetensors")).map(entry => entry.name);
  };
  const [transformerWeights, textEncoderWeights, vaeWeights] = await Promise.all([safeFilesIn("transformer"), safeFilesIn("text_encoder"), safeFilesIn("vae")]);
  if (missing.some(Boolean) || !transformerWeights.length || !vaeWeights.length || !textEncoderWeights.length) {
    return { ready: false, reason: "MOSS-Image 原生组件目录不完整；需包含 transformer、text_encoder、tokenizer 和 vae 的配置及 safetensors 权重。" };
  }
  return { ready: true, reason: null };
}

function includeNativeMossFiles(path: string): boolean {
  if (!path || path.includes("\\") || path.split("/").some(part => !part || part.startsWith("."))) return false;
  if (path === "LICENSE" || path === "README.md" || path === "model_index.json") return true;
  if (!/^(?:text_encoder|tokenizer|transformer|vae)\//u.test(path)) return false;
  if (path.endsWith(".safetensors") || path.endsWith(".json")) return true;
  return /^tokenizer\/(?:.*\.(?:txt|model))$/u.test(path);
}

export const MOSS_IMAGE_MODELS: LocalModelDefinition[] = [
  {
    id: "moss-image-base",
    name: "MOSS-Image Base",
    family: "MOSS-Image",
    modality: "image",
    task: "文字/布局生图",
    repository: "OpenMOSS-Team/MOSS-Image-Base",
    licenseName: "Apache-2.0",
    licenseUrl: `${HUGGING_FACE}/OpenMOSS-Team/MOSS-Image-Base/blob/main/LICENSE`,
    estimatedDownloadBytes: 27_200_000_000,
    modelDirectory: "image/moss-image-base",
    includeFile: includeNativeMossFiles,
    inspect: inspectMossImageModel
  },
  {
    id: "moss-image-sft",
    name: "MOSS-Image SFT",
    family: "MOSS-Image",
    modality: "image",
    task: "文字/布局生图",
    repository: "OpenMOSS-Team/MOSS-Image-SFT",
    licenseName: "Apache-2.0",
    licenseUrl: `${HUGGING_FACE}/OpenMOSS-Team/MOSS-Image-SFT/blob/main/LICENSE`,
    estimatedDownloadBytes: 27_200_000_000,
    modelDirectory: "image/moss-image-sft",
    includeFile: includeNativeMossFiles,
    inspect: inspectMossImageModel
  }
];

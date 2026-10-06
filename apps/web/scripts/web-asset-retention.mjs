/**
 * 功能：保留 Web 最近几代内容哈希资源。
 * 作用：页面升级后，已打开的旧标签仍能加载其懒加载模块；历史资源数量固定有界。
 * 关联文件：apps/web/vite.config.ts、apps/cli/tests/web-asset-retention.test.mjs。
 */
import { readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const HISTORY_FILENAME = ".lfaa-web-asset-history.json";
const MAX_RETAINED_GENERATIONS = 3;
const VERSIONED_ASSET_PATH = /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|avif|gif|wasm|map)$/iu;

function normalizeAssetPaths(paths) {
  if (!Array.isArray(paths)) return [];
  return [...new Set(paths
    .filter((path) => typeof path === "string")
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => VERSIONED_ASSET_PATH.test(path)))].sort();
}

async function listExistingVersionedAssets(outputDirectory) {
  let entries;
  try {
    entries = await readdir(resolve(outputDirectory, "assets"), { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && VERSIONED_ASSET_PATH.test(`assets/${entry.name}`))
    .map((entry) => `assets/${entry.name}`)
    .sort();
}

export async function readWebAssetHistory(outputDirectory) {
  const historyPath = resolve(outputDirectory, HISTORY_FILENAME);
  let source;
  try {
    source = await readFile(historyPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      const existing = await listExistingVersionedAssets(outputDirectory);
      return existing.length ? [existing] : [];
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`Web 资源保留记录损坏，为避免误删已打开页面资源而停止构建：${historyPath}`, { cause: error });
  }
  if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.generations)) {
    throw new Error(`Web 资源保留记录格式不受支持，为避免误删旧页面资源而停止构建：${historyPath}`);
  }
  return parsed.generations
    .filter(Array.isArray)
    .map(normalizeAssetPaths)
    .filter((generation) => generation.length > 0)
    .slice(0, MAX_RETAINED_GENERATIONS - 1);
}

export async function retainWebAssetGenerations(outputDirectory, currentAssetPaths, previousGenerations = []) {
  const current = normalizeAssetPaths(currentAssetPaths);
  if (current.length === 0) throw new Error("Web 构建没有生成带哈希资源，已停止历史资源清理。");

  const generations = [
    current,
    ...previousGenerations.filter(Array.isArray).map(normalizeAssetPaths).filter((generation) => generation.length > 0)
  ].slice(0, MAX_RETAINED_GENERATIONS);
  const retained = new Set(generations.flat());
  const historyPath = resolve(outputDirectory, HISTORY_FILENAME);
  const temporaryHistoryPath = `${historyPath}.tmp`;
  await writeFile(temporaryHistoryPath, `${JSON.stringify({ schemaVersion: 1, generations }, null, 2)}\n`, "utf8");
  await rename(temporaryHistoryPath, historyPath);

  const entries = await readdir(resolve(outputDirectory, "assets"), { withFileTypes: true });
  const removed = [];
  for (const entry of entries) {
    const assetPath = `assets/${entry.name}`;
    if (!entry.isFile() || !VERSIONED_ASSET_PATH.test(assetPath) || retained.has(assetPath)) continue;
    await unlink(resolve(outputDirectory, assetPath));
    removed.push(assetPath);
  }
  return { generations, removed };
}

export function createWebAssetRetentionPlugin(repositoryRoot) {
  let outputDirectory = "";
  let isActiveWebOutput = false;
  let previousGenerations = [];

  return {
    name: "lfaa-web-asset-retention",
    apply: "build",
    configResolved(config) {
      outputDirectory = config.build.outDir;
      isActiveWebOutput = resolve(config.root, outputDirectory) === resolve(repositoryRoot, "dist", "apps", "web");
    },
    async buildStart() {
      previousGenerations = isActiveWebOutput ? await readWebAssetHistory(outputDirectory) : [];
    },
    async writeBundle(_options, bundle) {
      if (!isActiveWebOutput) return;
      const currentAssets = Object.keys(bundle);
      const { generations, removed } = await retainWebAssetGenerations(outputDirectory, currentAssets, previousGenerations);
      this.info(`Web 哈希资源保留 ${generations.length} 代，清理 ${removed.length} 个过期资源。`);
    }
  };
}

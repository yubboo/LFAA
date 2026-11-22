// 插件二创：把插件包复制到 profile/plugins/<新 id>，换成独立包名并完成依赖探测；失败即回滚。
// 从 PluginManager 拆出：这段流程只依赖「定位源包 / 装 profile 依赖」两个回调，不碰 Loader 与状态表。
import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { PluginRecord } from "../../contract/index";

/** 二创所需的上下文：源记录、profile 根目录与两个外部回调。 */
export interface ForkPluginInput {
  /** 被复制的原始插件记录。 */
  source: PluginRecord;
  /** 插件 profile 根目录；副本落在 `<profileRoot>/plugins/<newId>`。 */
  profileRoot: string;
  /** 定位插件包目录：本仓包按清单名查找，本地插件按 file: URL 反查。 */
  locatePackage: (moduleName: string) => Promise<string>;
  /** 在 profile 内安装副本的依赖，让副本从 `<profile>/node_modules` 解析。 */
  installProfileDependencies: (sourceDir: string) => Promise<void>;
}

/**
 * 复制插件包并登记为新的未启用记录。
 * 依赖不可达时删除副本并抛出可执行原因（Windows 上 pnpm 的相对软链经 junction 后可能失效）。
 */
export async function forkPluginPackage({ source, profileRoot, locatePackage, installProfileDependencies }: ForkPluginInput): Promise<PluginRecord> {
  const sourceDir = await locatePackage(source.moduleName);
  const newId = `${source.id}-copy-${randomUUID().slice(0, 4)}`;
  const targetDir = join(profileRoot, "plugins", newId);
  await mkdir(targetDir, { recursive: true });
  for (const part of ["lib", "src", "contract"]) {
    await cp(join(sourceDir, part), join(targetDir, part), { recursive: true, force: true }).catch(() => undefined);
  }
  // 副本必须换名：profile 把 plugins/* 当 workspace 成员，同名会造成包名冲突。
  try {
    const sourceManifest = JSON.parse(await readFile(join(sourceDir, "package.json"), "utf8")) as {
      name?: string;
      dependencies?: Record<string, string>;
    };
    const forkedName = `${sourceManifest.name ?? "plugin"}-fork-${newId.slice(-4)}`;
    // 副本只保留运行时字段：devDependencies/scripts 会把构建期依赖带进 profile 安装。
    const forkedManifest = {
      name: forkedName,
      version: "0.0.1",
      private: true,
      type: "module",
      main: "./lib/index.js",
      exports: { ".": { default: "./lib/index.js" } },
      dependencies: sourceManifest.dependencies ?? {},
    };
    await writeFile(join(targetDir, "package.json"), `${JSON.stringify(forkedManifest, null, 2)}\n`, "utf8");
  } catch {
    await cp(join(sourceDir, "package.json"), join(targetDir, "package.json")).catch(() => undefined);
  }

  // 依赖解析：写入 profile 级 manifest 并执行 pnpm install，让副本从 <profile>/node_modules 解析。
  await installProfileDependencies(sourceDir);
  const entryFile = join(targetDir, "lib", "index.js");

  // 依赖可达性探测：与其留下一个启不动的副本，不如回滚并说明原因。
  try {
    await import(pathToFileURL(entryFile).href);
  } catch (error) {
    await rm(targetDir, { recursive: true, force: true }).catch(() => undefined);
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `二创副本已复制但依赖无法解析，已回滚：${detail}。`
      + "当前平台需要 profile 级依赖安装（pnpm install --dir <profile>）才能真正启用副本。",
    );
  }

  const now = Date.now();
  return {
    id: newId,
    moduleName: pathToFileURL(entryFile).href,
    manifest: {
      ...source.manifest,
      id: newId,
      name: `${source.manifest.name}（二创）`,
      description: `由 ${source.moduleName} 复制而来，可编辑 ${targetDir} 后启用。`,
    },
    source: "local",
    originPluginId: source.id,
    enabled: false,
    status: "disabled",
    installedAt: now,
    updatedAt: now,
  };
}
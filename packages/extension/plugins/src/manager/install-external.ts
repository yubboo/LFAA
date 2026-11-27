// 外部插件安装：校验来源 → `pnpm add` → 识别包名 → 登记 → 自动启用；任一环节失败回滚，不留半装状态。
// 从 PluginManager 拆出：这里只操作 profile 包与记录回调，不碰 Loader 与运行时状态表。
import type { PluginRecord } from "../../contract/index";
import { parseInstallSpec as parseSpec } from "../catalog/install-spec";
import { toRecordId } from "../catalog/record-id";
import type { ProfilePackages } from "./profile-packages";

/** 安装所需依赖：profile 包操作 + 记录读写 + 启用回调。 */
export interface ExternalInstallInput {
  /** 用户输入：npm 包名 / Git / 本地路径 / 压缩包。 */
  input: string;
  /** 透传 pnpm 输出行，供插件页流式展示。 */
  onLine?: ((line: string) => void) | undefined;
  /** profile 级包操作（manifest、pnpm、入口解析）。 */
  packages: ProfilePackages;
  readRecords: () => Promise<PluginRecord[]>;
  writeRecords: (records: PluginRecord[]) => Promise<void>;
  /** 安装成功后自动启用并返回 hydrated 记录。 */
  enablePlugin: (id: string) => Promise<PluginRecord>;
}

/**
 * 安装外部插件并返回可展示的记录。
 * 启用失败时回滚依赖（`pnpm remove`）并删除记录，避免留下「装了但启不动」的半装状态。
 */
export async function installExternalPlugin({ input, onLine, packages, readRecords, writeRecords, enablePlugin }: ExternalInstallInput): Promise<PluginRecord> {
  const parsed = parseSpec(input);
  await packages.ensureManifest();
  const spec = parsed.spec;

  const install = await packages.run(["add", spec], onLine);
  if (install.code !== 0) {
    throw new Error(`安装失败（退出码 ${install.code}）：${install.output.trim().slice(-400)}`);
  }

  const moduleName = await packages.resolveInstalledName(spec, parsed.kind === "registry" ? parsed.name : undefined);
  // 外部包装在 profile 的 node_modules 里：记录绝对入口 URL，
  // 否则 Loader 会以应用目录为基准解析包名而找不到。
  const entryFile = await packages.resolvePackageEntry(moduleName);
  const id = toRecordId(moduleName);

  try {
    const records = await readRecords();
    const existing = records.find((record) => record.id === id);
    const now = Date.now();
    const record: PluginRecord = existing ?? {
      id,
      moduleName: entryFile,
      manifest: {
        id,
        name: moduleName,
        version: "0.0.0",
        description: `外部插件：${parsed.spec}`,
        entryType: "local-manifest",
        capabilities: { tools: [], skills: [], views: [] },
      },
      source: "local",
      kind: "external",
      enabled: false,
      status: "disabled",
      installedAt: now,
      updatedAt: now,
    };
    if (!existing) await writeRecords([...records, record]);
    return await enablePlugin(id);
  } catch (error) {
    // 启用失败：卸载依赖并删除记录，避免半装。
    await packages.run(["remove", moduleName]).catch(() => undefined);
    const left = await readRecords();
    await writeRecords(left.filter((record) => record.id !== id)).catch(() => undefined);
    throw error;
  }
}

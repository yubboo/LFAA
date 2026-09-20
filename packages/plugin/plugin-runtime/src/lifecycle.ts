/**
 * 文件：lifecycle.ts
 * 作用：定义插件 Profile 安装、启用、取消和回滚的单一业务契约。
 * 负责：Host Port、安装结果、Bundle 状态，以及 Web/CLI/Agent 共用的 PluginManager。
 * 不负责：pnpm/文件系统具体实现、React UI、执行第三方插件代码。
 */
import type { LfaaPluginManifest } from "@lfaa/plugin-sdk";
import { PluginRegistry, type PluginRegistrySnapshot } from "./registry.ts";
import { parsePluginInstallSpec, type ParsedPluginInstallSpec } from "./install-spec.ts";

export type PluginInstallSourceKind = ParsedPluginInstallSpec["kind"];
export type PluginInspectProblem =
  | "invalid-spec"
  | "not-found"
  | "already-installed"
  | "not-lfaa-plugin"
  | "incompatible-plugin-api"
  | "package-manager-unavailable"
  | "inspection-failed";

export type PluginSpecInspection =
  | {
      readonly status: "accepted";
      readonly sourceKind: PluginInstallSourceKind;
      readonly spec: string;
      readonly packageName: string;
      readonly packageVersion: string;
      readonly description?: string;
      /** 安装前检查得到的稳定身份摘要；Host 安装后必须重新计算并一致，防止可变来源静默换包。 */
      readonly inspectionFingerprint: string;
      readonly manifest: LfaaPluginManifest;
    }
  | {
      readonly status: "refused";
      readonly sourceKind?: PluginInstallSourceKind;
      readonly spec: string;
      readonly problem: PluginInspectProblem;
      readonly reason: string;
    };

export type PluginInstallFailureKind =
  | "build-blocked"
  | "not-found"
  | "no-matching-version"
  | "network"
  | "permission"
  | "disk-full"
  | "integrity"
  | "timeout"
  | "package-manager-missing"
  | "cancelled"
  | "invalid-installed-manifest"
  | "unknown";

export interface InstalledPluginBundle {
  readonly packageName: string;
  readonly packageVersion: string;
  readonly enabled: boolean;
  readonly manifest: LfaaPluginManifest;
}

export interface PluginInstallProgress {
  readonly requestId: string;
  readonly phase: "inspecting" | "installing" | "validating" | "committing" | "rolling-back" | "completed";
  readonly message?: string;
}

export interface PluginInstallOutcome {
  readonly status: "installed" | "failed" | "cancelled";
  readonly bundle?: InstalledPluginBundle;
  readonly failureKind?: PluginInstallFailureKind;
  readonly diagnostic?: string;
  readonly pendingBuilds?: readonly string[];
  readonly logPath?: string;
}

export interface PluginPackageHostPort {
  /** 必须只读检查；不得改变正式 plugin profile。 */
  inspect(spec: ParsedPluginInstallSpec, signal?: AbortSignal): Promise<PluginSpecInspection>;
  /** 返回当前 profile 中所有 LFAA bundle；不得加载执行其代码。 */
  listInstalled(): Promise<readonly InstalledPluginBundle[]>;
  /**
   * 事务安装：失败/取消/装入无效 Manifest 时恢复 package.json + lockfile；默认 enabled=false。
   * `approvedBuilds` 只允许本次 inspection 之后仍处于 pending 的精确包名。
   */
  install(
    inspection: Extract<PluginSpecInspection, { status: "accepted" }>,
    options: { readonly requestId: string; readonly approvedBuilds?: readonly string[]; readonly onProgress?: (event: PluginInstallProgress) => void },
  ): Promise<PluginInstallOutcome>;
  setEnabled(packageName: string, enabled: boolean): Promise<InstalledPluginBundle>;
  remove(packageName: string): Promise<void>;
  cancel(requestId: string): Promise<void>;
}

export interface PluginManagerSnapshot {
  readonly registry: PluginRegistrySnapshot;
  readonly installed: readonly InstalledPluginBundle[];
}

/** Web、CLI 与 Agent 必须共用这个 Manager；入口不得各自调用 pnpm。 */
export class PluginManager {
  readonly #host: PluginPackageHostPort;
  readonly #registry: PluginRegistry;
  #mutationTail: Promise<void> = Promise.resolve();

  constructor(host: PluginPackageHostPort, registry = new PluginRegistry()) {
    this.#host = host;
    this.#registry = registry;
  }

  /** 所有持久化 mutation 串行，避免 Profile 与 Registry 两个事实源交叉提交。 */
  async #mutate<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#mutationTail;
    let release!: () => void;
    this.#mutationTail = new Promise<void>((resolve) => { release = resolve; });
    await previous.catch(() => undefined);
    try { return await operation(); }
    finally { release(); }
  }

  async hydrate(): Promise<PluginManagerSnapshot> {
    const installed = await this.#host.listInstalled();
    for (const bundle of installed) if (bundle.enabled) this.#registry.register(bundle.manifest);
    return { installed, registry: this.#registry.snapshot() };
  }

  async snapshot(): Promise<PluginManagerSnapshot> {
    return { installed: await this.#host.listInstalled(), registry: this.#registry.snapshot() };
  }

  async inspect(rawSpec: string, signal?: AbortSignal): Promise<PluginSpecInspection> {
    let parsed: ParsedPluginInstallSpec;
    try { parsed = parsePluginInstallSpec(rawSpec); }
    catch (error) {
      return { status: "refused", spec: rawSpec.trim(), problem: "invalid-spec", reason: error instanceof Error ? error.message : "插件来源无效。" };
    }
    return this.#host.inspect(parsed, signal);
  }

  async install(
    rawSpec: string,
    options: { readonly requestId: string; readonly approvedBuilds?: readonly string[]; readonly onProgress?: (event: PluginInstallProgress) => void },
  ): Promise<PluginInstallOutcome> {
    return this.#mutate(async () => {
      options.onProgress?.({ requestId: options.requestId, phase: "inspecting" });
      const inspection = await this.inspect(rawSpec);
      if (inspection.status === "refused") {
        return { status: "failed", failureKind: inspection.problem === "not-found" ? "not-found" : "unknown", diagnostic: inspection.reason };
      }
      return this.#host.install(inspection, options);
    });
  }

  async setEnabled(packageName: string, enabled: boolean): Promise<PluginManagerSnapshot> {
    return this.#mutate(async () => {
      if (!enabled) {
        const bundle = await this.#host.setEnabled(packageName, false);
        this.#registry.unregister(bundle.manifest.pluginId);
        return this.snapshot();
      }

      // 先只验证下一 generation，再提交 Profile；只有持久化成功才真正发布 Registry generation。
      const bundle = (await this.#host.listInstalled()).find((item) => item.packageName === packageName);
      if (!bundle) throw new Error(`插件未安装：${packageName}`);
      this.#registry.assertCanRegister(bundle.manifest);
      await this.#host.setEnabled(packageName, true);
      this.#registry.register(bundle.manifest);
      return this.snapshot();
    });
  }

  async remove(packageName: string): Promise<PluginManagerSnapshot> {
    return this.#mutate(async () => {
      const installed = await this.#host.listInstalled();
      const bundle = installed.find((item) => item.packageName === packageName);
      if (bundle?.enabled) this.#registry.unregister(bundle.manifest.pluginId);
      try { await this.#host.remove(packageName); }
      catch (error) {
        // Host removal intentionally disables before package removal; Registry must stay aligned with that partial state.
        throw error;
      }
      return this.snapshot();
    });
  }

  cancel(requestId: string): Promise<void> { return this.#host.cancel(requestId); }
}

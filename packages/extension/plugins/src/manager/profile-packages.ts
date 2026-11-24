// Profile 目录与依赖管理：目录骨架、cordis.yml 快照、pnpm 执行、包名/入口解析与仓库包定位。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { PluginRecord } from "../../contract/index";
import { spawnPnpm } from "./pnpm-spawn";

export class ProfilePackages {
  readonly profileRoot: string;
  private readonly profileName: string;
  private readonly repoRoot: string | null;

  constructor(profile: string, profileRoot: string, repoRoot: string | null) {
    this.profileName = profile;
    this.profileRoot = profileRoot;
    this.repoRoot = repoRoot ? resolve(repoRoot) : null;
  }

  /** 按 DSH Profile 规范初始化 profile 目录骨架。 */
  async ensureLayout(): Promise<void> {
    await mkdir(join(this.profileRoot, ".plugin-manager"), { recursive: true });
    await mkdir(join(this.profileRoot, "node_modules"), { recursive: true });

    const ensureFile = async (fileName: string, content: string) => {
      const target = join(this.profileRoot, fileName);
      if (!existsSync(target)) await writeFile(target, content, "utf8");
    };

    await ensureFile(
      "package.json",
      JSON.stringify({ name: `@lfaa/profile-${this.profileName}`, private: true, type: "module", dependencies: {} }, null, 2),
    );
    await ensureFile("pnpm-workspace.yaml", "packages:\n  - \"plugins/*\"\n");
    await ensureFile("cordis.yml", "plugins: {}\n");
    await ensureFile("cordis.patch.yml", "# 用户本地插件配置补丁\n");
    await ensureFile("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  }

  /** 把已启用记录同步进 cordis.yml，作为 profile 的可读快照。 */
  async syncCordisYml(records: PluginRecord[]): Promise<void> {
    const lines = ["plugins:"];
    const enabled = records.filter((r) => r.enabled);
    if (enabled.length === 0) {
      lines.push("  {}");
    } else {
      for (const rec of enabled) {
        lines.push(`  ${rec.id}:`);
        lines.push(`    name: "${rec.moduleName}"`);
        lines.push(`    version: "${rec.manifest.version}"`);
      }
    }
    const target = join(this.profileRoot, "cordis.yml");
    await mkdir(this.profileRoot, { recursive: true });
    const tmp = `${target}.${randomUUID()}.tmp`;
    await writeFile(tmp, `${lines.join("\n")}\n`, "utf8");
    await rename(tmp, target);
  }

  /** 确保 profile 有一份可安装的 manifest 与 workspace 声明。 */
  async ensureManifest(): Promise<void> {
    await this.ensureLayout();
    const manifestPath = join(this.profileRoot, "package.json");
    if (!existsSync(manifestPath)) {
      await writeFile(manifestPath, `${JSON.stringify({ name: `@lfaa/profile-${this.profileName}`, private: true, type: "module", dependencies: {} }, null, 2)}\n`, "utf8");
    }
    const workspacePath = join(this.profileRoot, "pnpm-workspace.yaml");
    if (!existsSync(workspacePath)) {
      await writeFile(workspacePath, "packages:\n  - \"plugins/*\"\n", "utf8");
    }
  }

  /** 执行一条 profile 内的 pnpm 命令并回传输出，供安装/回滚共用。 */
  async run(args: string[], onLine?: (line: string) => void): Promise<{ code: number; output: string }> {
    // `--no-frozen-lockfile` 只对 install 有效；add/remove 会报未知选项。
    const lockFlag = args[0] === "install" ? ["--no-frozen-lockfile"] : [];
    // append-only 让 pnpm 输出退化为逐行日志，SSE 才能实时看到进展。
    const full = [...args, "--dir", this.profileRoot, "--prefer-offline", "--reporter=append-only", ...lockFlag];
    // 参数校验与平台差异都在 spawnPnpm 内处理：Windows 不再拼接裸命令行。
    const child = spawnPnpm(full, this.profileRoot);
    let output = "";
    let lineBuffer = "";
    const pushChunk = (chunk: unknown) => {
      const text = String(chunk);
      output += text;
      if (!onLine) return;
      lineBuffer += text;
      const lines = lineBuffer.split(/\r?\n/u);
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) onLine(line);
      }
    };
    child.stdout?.on("data", pushChunk);
    child.stderr?.on("data", pushChunk);
    const code = await new Promise<number>((done) => {
      let settled = false;
      const finish = (value: number) => {
        if (settled) return;
        settled = true;
        if (onLine && lineBuffer.trim()) onLine(lineBuffer);
        done(value);
      };
      child.once("error", (err) => {
        output += `\n${err.message}`;
        finish(1);
      });
      child.once("close", (value) => finish(value ?? 1));
    });
    return { code, output };
  }

  /** 从 profile 依赖里找出刚落盘的包名：registry 用名字，其余按值匹配。 */
  async resolveInstalledName(spec: string, fallbackName?: string): Promise<string> {
    const raw = await readFile(join(this.profileRoot, "package.json"), "utf8");
    const manifest = JSON.parse(raw) as { dependencies?: Record<string, string> };
    const entries = Object.entries(manifest.dependencies ?? {});
    if (fallbackName) {
      const byName = entries.find(([name]) => name === fallbackName);
      if (byName) return byName[0];
    }
    const normalized = spec.replace(/^(?:file|link):/u, "").split("\\").join("/").toLowerCase();
    const hit = entries.find(([, value]) => {
      const recorded = value.replace(/^(?:file|link):/u, "").split("\\").join("/").toLowerCase();
      return recorded.includes(normalized) || normalized.includes(recorded) || value === spec;
    });
    if (!hit) throw new Error("安装完成但未能从 profile 依赖中识别出包名。");
    return hit[0];
  }

  /** 读取已安装包在 profile 中的入口文件，返回 file: URL。 */
  async resolvePackageEntry(name: string): Promise<string> {
    const dir = join(this.profileRoot, "node_modules", name);
    const manifest = JSON.parse(await readFile(join(dir, "package.json"), "utf8")) as {
      main?: string;
      module?: string;
      exports?: Record<string, unknown> | string;
    };
    let entry = manifest.main ?? manifest.module ?? "index.js";
    const root = manifest.exports;
    if (root && typeof root === "object") {
      const dot = (root as Record<string, unknown>)["."];
      if (typeof dot === "string") entry = dot;
      else if (dot && typeof dot === "object") {
        const cond = dot as Record<string, unknown>;
        const candidate = cond.default ?? cond.import ?? cond.require;
        if (typeof candidate === "string") entry = candidate;
      }
    }
    return pathToFileURL(join(dir, entry)).href;
  }

  /** 枚举仓库内的全部包：名称 → 绝对目录。 */
  async repoPackages(): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    if (!this.repoRoot) return found;
    const walk = async (dir: string, depth: number): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === "node_modules") continue;
        const child = join(dir, entry.name);
        try {
          const manifest = JSON.parse(await readFile(join(child, "package.json"), "utf8")) as { name?: string };
          if (manifest.name) found.set(manifest.name, child);
        } catch {
          if (depth > 0) await walk(child, depth - 1);
        }
      }
    };
    await walk(join(this.repoRoot, "packages"), 1);
    await walk(join(this.repoRoot, "vendor"), 0);
    return found;
  }

  /**
   * profile 级依赖安装：把仓库包以 link: 写进 profile manifest，
   * 并带上副本包的第三方依赖，然后执行 pnpm install。
   * 这样副本的 lib/index.js 从 <profile>/node_modules 解析，不再依赖 junction。
   */
  async installProfileDependencies(sourceDir: string): Promise<void> {
    const packages = await this.repoPackages();
    if (packages.size === 0) throw new Error("未找到仓库包，无法建立 profile 依赖解析。");

    const dependencies: Record<string, string> = {};
    for (const [name, dir] of packages) {
      dependencies[name] = `link:${relative(this.profileRoot, dir).split(sep).join("/")}`;
    }

    // 副本包的第三方依赖（非 @lfaa/*）交给 pnpm 安装。
    try {
      const sourceManifest = JSON.parse(await readFile(join(sourceDir, "package.json"), "utf8")) as {
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };
      for (const [name, spec] of Object.entries({ ...(sourceManifest.dependencies ?? {}), ...(sourceManifest.peerDependencies ?? {}) })) {
        if (name.startsWith("@lfaa/") || name in dependencies) continue;
        if (spec.startsWith("workspace:")) continue;
        // 优先复用源包已经解析好的依赖目录（link:），避免 profile 安装时再联网。
        const resolved = await realpath(join(sourceDir, "node_modules", name)).catch(() => null);
        dependencies[name] = resolved ? `link:${resolved.split(sep).join("/")}` : spec;
      }
    } catch {
      // 读取失败时只保留仓库包链接。
    }

    const manifest = {
      name: `@lfaa/profile-${this.profileName}`,
      private: true,
      type: "module",
      dependencies,
    };
    await mkdir(this.profileRoot, { recursive: true });
    await writeFile(join(this.profileRoot, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const args = ["install", "--dir", this.profileRoot, "--prefer-offline", "--no-frozen-lockfile"];
    // 统一走 spawnPnpm：参数校验与平台差异集中在一处，Windows 不再手工拼接命令行。
    const install = spawnPnpm(args, this.profileRoot);
    let output = "";
    install.stdout?.on("data", (chunk) => { output += String(chunk); });
    install.stderr?.on("data", (chunk) => { output += String(chunk); });
    const code = await new Promise<number>((done) => {
      let settled = false;
      const finish = (value: number) => {
        if (settled) return;
        settled = true;
        done(value);
      };
      install.once("error", (err) => {
        output += `\n${err.message}`;
        finish(1);
      });
      install.once("close", (value) => finish(value ?? 1));
    });
    if (code !== 0) {
      throw new Error(`profile 依赖安装失败（退出码 ${code}）：${output.trim().slice(-300)}`);
    }
  }

  /** 定位插件包目录：本仓包按清单名查找，本地插件按 file: URL 反查。 */
  async locatePackage(moduleName: string): Promise<string> {
    if (moduleName.startsWith("file:")) return dirname(dirname(fileURLToPath(moduleName)));
    if (!this.repoRoot) throw new Error("未配置仓库根目录，无法定位插件包。");
    const want = moduleName;
    const search = async (dir: string, depth: number): Promise<string | null> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return null;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === "node_modules") continue;
        const child = join(dir, entry.name);
        try {
          const manifest = JSON.parse(await readFile(join(child, "package.json"), "utf8")) as { name?: string };
          if (manifest.name === want) return child;
        } catch {
          if (depth > 0) {
            const hit = await search(child, depth - 1);
            if (hit) return hit;
          }
        }
      }
      return null;
    };
    const found = await search(join(this.repoRoot, "packages"), 1) ?? await search(join(this.repoRoot, "vendor"), 0);
    if (!found) throw new Error(`找不到插件包目录：${moduleName}`);
    return found;
  }
}
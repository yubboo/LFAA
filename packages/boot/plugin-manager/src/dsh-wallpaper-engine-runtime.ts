/**
 * 功能：在 LFAA Web Host 中托管经来源核验且符合兼容合同的 DSH Wallpaper Engine Host/Client。
 * 作用：核验已安装快照、准备受控运行副本、挂入同一个 Cordis Loader，并把账户壁纸选择交回 Settings Owner。
 * 关联文件：index.ts、packages/host/webserver/src/dsh-carrier.ts、packages/settings/settings/src/service.ts。
 */
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import type { Context } from "@deepseek-ai/cordis";
import { getUserSettings, saveUserSettings } from "lfaa-settings/src/service.js";
import type { PluginRecord, PluginRuntimeAdapter } from "./index.js";
import type { PluginArchiveFile } from "./zip-archive.js";

const REPOSITORY = "https://github.com/elysia395/dsh-wallpaper-engine";
const PACKAGE_ID = "dsh-plugin-wallpaper-engine";
const RECORD_ID = "elysia395-dsh-wallpaper-engine";
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/iu;
const ARCHIVE_SHA256_PATTERN = /^[0-9a-f]{64}$/iu;
const ROUTE = "/wallpaper-engine/settings";
const BODY_LIMIT = 64 * 1024;
const BODY_IDLE_TIMEOUT_MS = 60_000;
const ADAPTER_REVISION = 7;

interface LoaderEntry {
  fiber?: { state?: number; inertia?: Promise<unknown>; await?: () => Promise<unknown>; dispose?: () => void | Promise<void> };
}
interface DynamicLoader {
  create(options: { name: string; inject: string[]; config: Record<string, unknown> }): Promise<string>;
  resolve(id: string): LoaderEntry | undefined;
  remove(id: string): void;
}
interface RouteCarrier {
  registerHandlerAdapter(owner: object, path: string, adapter: (request: import("express").Request, response: import("express").Response, dispatch: (request?: import("express").Request, response?: import("express").Response) => void | Promise<void>) => void | Promise<void>): () => void;
}
interface ActivePlugin { entryId: string; restoreDataDirectory: string | undefined }

/** Official-repository DSH v1 adapter. It never runs arbitrary DSH plugin records. */
export class DshWallpaperEngineRuntime implements PluginRuntimeAdapter {
  private readonly active = new Map<string, ActivePlugin>();
  private readonly loader: DynamicLoader;
  private readonly dataDirectory: string;
  private readonly profile: string;
  private readonly disposeRouteAdapter: () => void;

  constructor(context: Context, profile: string, dataDirectory: string) {
    this.loader = context.get("loader") as unknown as DynamicLoader;
    this.dataDirectory = resolve(dataDirectory);
    if (!/^[a-z][a-z0-9-]{0,63}$/u.test(profile)) throw new Error("Wallpaper Engine Runtime 的 Profile 名称无效。");
    this.profile = profile;
    const carrier = context.get("webServer") as unknown as RouteCarrier;
    if (!carrier || typeof carrier.registerHandlerAdapter !== "function") throw new Error("Wallpaper Engine Runtime 需要 LFAA DSH WebServer Carrier。");
    this.disposeRouteAdapter = carrier.registerHandlerAdapter(this, ROUTE, (request, response, dispatch) => this.adaptSettingsRequest(request, response, dispatch));
    context.effect(() => async () => {
      await this.stopAll();
      this.disposeRouteAdapter();
    });
  }

  supports(record: PluginRecord): boolean {
    return record.id === RECORD_ID
      && record.name === PACKAGE_ID
      && VERSION_PATTERN.test(record.version)
      && record.compatibility === "dsh-v1"
      && normalizeRepository(record.source.repository) === REPOSITORY.toLocaleLowerCase("en-US")
      && COMMIT_PATTERN.test(record.source.commit)
      && ARCHIVE_SHA256_PATTERN.test(record.source.archiveSha256);
  }

  inspectSnapshot(record: PluginRecord, files: readonly PluginArchiveFile[]): { supported: boolean; reason: string | null } {
    if (!this.supports(record)) return { supported: false, reason: "Wallpaper Engine 来源记录不符合官方仓库合同。" };
    const result = inspectWallpaperEngineSources(record, files);
    return { supported: result.supported, reason: result.reason };
  }

  async enable(record: PluginRecord, installedDirectory: string): Promise<void> {
    if (!this.supports(record)) throw new Error("Wallpaper Engine 仅允许经核验的官方仓库 DSH v1 兼容版本启用。");
    if (this.active.has(record.id)) return;
    const entrypoint = await this.prepareRuntimeCopy(installedDirectory, record);
    const pluginDataDirectory = resolve(this.dataDirectory, "plugins", "runtime-data", "profiles", this.profile, PACKAGE_ID);
    mkdirSync(pluginDataDirectory, { recursive: true, mode: 0o700 });

    const oldDataDirectory = process.env.DSH_WE_DATA_DIR;
    process.env.DSH_WE_DATA_DIR = pluginDataDirectory;
    let entryId: string | undefined;
    try {
      await import(pathToFileURL(entrypoint).href);
      entryId = await this.loader.create({ name: pathToFileURL(entrypoint).href, inject: ["webServer"], config: {} });
      const entry = this.loader.resolve(entryId);
      await entry?.fiber?.await?.();
      if (!entry?.fiber || entry.fiber.state !== 2) throw new Error("DSH Wallpaper Engine Host 未进入 Cordis ACTIVE 状态。");
      this.active.set(record.id, { entryId, restoreDataDirectory: oldDataDirectory });
    } catch (error) {
      if (entryId) await this.removeLoaderEntry(entryId);
      restoreEnvironment("DSH_WE_DATA_DIR", oldDataDirectory);
      throw error;
    }
  }

  async disable(record: PluginRecord): Promise<void> {
    const active = this.active.get(record.id);
    if (!active) return;
    await this.removeLoaderEntry(active.entryId);
    this.active.delete(record.id);
    restoreEnvironment("DSH_WE_DATA_DIR", active.restoreDataDirectory);
  }

  isActive(record: PluginRecord): boolean { return this.active.has(record.id); }

  private runtimeRootFor(record: PluginRecord): string {
    if (!COMMIT_PATTERN.test(record.source.commit)) throw new Error("Wallpaper Engine 来源提交号格式无效。");
    return resolve(this.dataDirectory, "plugins", "runtime-adapters", "profiles", this.profile, PACKAGE_ID,
      record.source.commit.toLocaleLowerCase("en-US"), `adapter-${ADAPTER_REVISION}`);
  }

  private async stopAll(): Promise<void> {
    for (const [id, active] of [...this.active]) {
      await this.removeLoaderEntry(active.entryId).catch(() => undefined);
      this.active.delete(id);
      restoreEnvironment("DSH_WE_DATA_DIR", active.restoreDataDirectory);
    }
  }

  private async removeLoaderEntry(entryId: string): Promise<void> {
    const entry = this.loader.resolve(entryId);
    const fiber = entry?.fiber;
    // Cordis Loader.remove() fires Fiber.dispose() but discards its promise. Capture the Fiber teardown first so plugin routes, timers and child processes are fully released before this resolves.
    const disposal = fiber?.dispose?.();
    try {
      this.loader.remove(entryId);
    } finally {
      if (disposal) await disposal;
      while (fiber?.inertia) await fiber.inertia;
    }
  }

  private async prepareRuntimeCopy(installedDirectory: string, record: PluginRecord): Promise<string> {
    const source = resolve(installedDirectory);
    const runtimeRoot = this.runtimeRootFor(record);
    const requiredFiles = ["package.json", "lib/index.js", "lib/client.js", "lib/http-body.js", "lib/settings-schema.js", "lib/routes/scene-serve.js", "cordis.patch.yml"];
    const files: PluginArchiveFile[] = [];
    for (const required of requiredFiles) {
      const file = resolve(source, ...required.split("/"));
      if (!file.startsWith(`${source}${sep}`) || !existsSync(file) || !lstatSync(file).isFile()) throw new Error(`Wallpaper Engine 源码缺少普通文件：${required}`);
      files.push({ path: required, contents: readFileSync(file) });
    }
    const inspected = inspectWallpaperEngineSources(record, files);
    if (!inspected.supported) throw new Error(inspected.reason ?? "Wallpaper Engine 来源快照不符合兼容合同。");
    const originalManifest = inspected.manifest!;

    if (existsSync(runtimeRoot)) {
      const markerPath = resolve(runtimeRoot, "lfaa-runtime-adapter.json");
      const marker = JSON.parse(readFileSync(markerPath, "utf8")) as Record<string, unknown>;
      const manifest = JSON.parse(readFileSync(resolve(runtimeRoot, "package.json"), "utf8")) as Record<string, unknown>;
      if (marker.sourceCommit !== record.source.commit.toLocaleLowerCase("en-US") || marker.sourceVersion !== record.version
        || marker.sourceArchiveSha256 !== record.source.archiveSha256.toLocaleLowerCase("en-US")
        || marker.adapterRevision !== ADAPTER_REVISION || manifest.name !== PACKAGE_ID || manifest.version !== record.version
        || typeof marker.contentSha256 !== "string" || marker.contentSha256 !== runtimeContentDigest(runtimeRoot)) {
        throw new Error("Wallpaper Engine Runtime 副本与当前来源/适配版本不匹配；为保留已有文件，没有覆盖。");
      }
      return resolve(runtimeRoot, "lib", "index.js");
    }

    const staging = resolve(dirname(runtimeRoot), `.stage-${randomUUID()}`);
    mkdirSync(staging, { recursive: true, mode: 0o700 });
    try {
      copyRuntimeFiles(source, staging);
      const manifest = { ...originalManifest };
      const dsh = structuredClone(asRecord(manifest.dsh));
      const client = structuredClone(asRecord(dsh.client));
      client.inject = ["slots", "shortcuts", "theme"];
      client.external = ["@deepseek-ai/cordis", "@deepseek-ai/dsh-client-ui-slots", "react", "react-dom"];
      dsh.client = client;
      manifest.dsh = dsh;
      writeFileSync(resolve(staging, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "w", mode: 0o600 });

      const hostPath = resolve(staging, "lib", "index.js");
      writeFileSync(hostPath, inspected.adaptedHost!, { flag: "w", mode: 0o600 });
      const clientPath = resolve(staging, "lib", "client.js");
      writeFileSync(clientPath, inspected.adaptedClient!, { flag: "w", mode: 0o600 });
      const sceneServePath = resolve(staging, "lib", "routes", "scene-serve.js");
      writeFileSync(sceneServePath, inspected.adaptedSceneServe!, { flag: "w", mode: 0o600 });
      const contentSha256 = runtimeContentDigest(staging);
      writeFileSync(resolve(staging, "lfaa-runtime-adapter.json"), `${JSON.stringify({
        sourceCommit: record.source.commit.toLocaleLowerCase("en-US"),
        sourceVersion: record.version,
        sourceArchiveSha256: record.source.archiveSha256.toLocaleLowerCase("en-US"),
        adapterRevision: ADAPTER_REVISION,
        contentSha256
      }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      mkdirSync(dirname(runtimeRoot), { recursive: true, mode: 0o700 });
      renameSync(staging, runtimeRoot);
    } catch (error) {
      rmSync(staging, { recursive: true, force: true });
      throw error;
    }
    return resolve(runtimeRoot, "lib", "index.js");
  }

  private async adaptSettingsRequest(
    request: import("express").Request,
    response: import("express").Response,
    dispatch: (request?: import("express").Request, response?: import("express").Response) => void | Promise<void>,
  ): Promise<void> {
    const userId = (request as typeof request & { auth?: { user?: { id?: string } } }).auth?.user?.id;
    if (!userId) throw new Error("Wallpaper Engine Settings 请求缺少已认证账户。");
    const method = request.method.toUpperCase();
    if (method === "GET") {
      await dispatch(undefined, withJsonTransform(response, (payload) => overlayAccountSelection(payload, userId)));
      return;
    }
    if (method !== "PUT") { await dispatch(); return; }

    const raw = await readRequestBody(request, response);
    if (raw === null) return;
    let parsed: unknown;
    try { parsed = JSON.parse(raw.toString("utf8")); }
    catch { await dispatch(withSyntheticBody(request, raw)); return; }
    if (!isRecord(parsed)) { await dispatch(withSyntheticBody(request, raw)); return; }

    const hasSelection = Object.hasOwn(parsed, "id");
    const requestedId = hasSelection ? parsed.id : getUserSettings(userId).appearance.wallpaperEngine.projectId;
    if (typeof requestedId !== "string" || !isSafeWallpaperProjectId(requestedId)) {
      response.status(400).json({ error: "invalid wallpaper project id" });
      return;
    }
    const sharedSettings = { ...parsed, id: "" };
    const body = Buffer.from(JSON.stringify(sharedSettings), "utf8");
    const saveAccountSelection = (payload: Record<string, unknown>) => {
      if (payload.ok === true && hasSelection) {
        const current = getUserSettings(userId).appearance;
        saveUserSettings(userId, "appearance", {
          ...current,
          wallpaperEngine: { enabled: requestedId.length > 0, projectId: requestedId },
        });
      }
      return overlayAccountSelection(payload, userId, requestedId);
    };
    await dispatch(withSyntheticBody(request, body), withJsonTransform(response, saveAccountSelection));
  }
}

function normalizeRepository(repository: string): string {
  return repository.replace(/\.git$/iu, "").replace(/\/+$/u, "").toLocaleLowerCase("en-US");
}

function inspectWallpaperEngineSources(record: PluginRecord, files: readonly PluginArchiveFile[]): {
  supported: boolean;
  reason: string | null;
  manifest?: Record<string, unknown>;
  adaptedHost?: string;
  adaptedClient?: string;
  adaptedSceneServe?: string;
} {
  try {
    const byPath = new Map<string, Buffer>();
    for (const file of files) {
      if (byPath.has(file.path)) throw new Error(`Wallpaper Engine 来源包含重复文件：${file.path}`);
      byPath.set(file.path, file.contents);
    }
    const required = ["package.json", "lib/index.js", "lib/client.js", "lib/http-body.js", "lib/settings-schema.js", "lib/routes/scene-serve.js", "cordis.patch.yml"];
    for (const path of required) if (!byPath.has(path)) throw new Error(`Wallpaper Engine 来源缺少普通文件：${path}`);
    const manifest = JSON.parse(byPath.get("package.json")!.toString("utf8")) as Record<string, unknown>;
    verifySourceManifest(manifest, record);
    const adaptedHost = adaptHostSource(byPath.get("lib/index.js")!.toString("utf8"));
    const adaptedClient = adaptClientSource(byPath.get("lib/client.js")!.toString("utf8"));
    const adaptedSceneServe = adaptSceneServeSource(byPath.get("lib/routes/scene-serve.js")!.toString("utf8"));
    return { supported: true, reason: null, manifest, adaptedHost, adaptedClient, adaptedSceneServe };
  } catch (error) {
    return { supported: false, reason: error instanceof Error ? error.message : "Wallpaper Engine 来源无法通过兼容合同。" };
  }
}

function adaptClientSource(source: string): string {
  const ropeDock = source.match(/^[\t ]*\/\/ 3\. Chat-interface rope dock:[\s\S]*?(?=^[\t ]*\/\/ Settings first \()/gmu) ?? [];
  const apply = source.match(/^[\t ]*function apply\(ctx\) \{/gmu) ?? [];
  const moduleExport = source.match(/^[\t ]*exports\.apply = apply;\r?\n[\t ]*exports\.inject = inject;\r?\n[\t ]*return module\.exports;$/gmu) ?? [];
  if (ropeDock.length !== 1 || !ropeDock[0]!.includes("ReactDOM.createRoot(host)") || !ropeDock[0]!.includes("RopeDock")
    || apply.length !== 1 || moduleExport.length !== 1) {
    throw new Error("固定 Wallpaper Engine Client 的 RopeDock/app 导出生命周期锚点不匹配；没有创建第二个 React 根。");
  }
  const slottedDock = source.replace(ropeDock[0]!, `\t\t// RopeDock is rendered by LFAA's existing UI root through the declared overlay slot.\n\t\tif (ctx.effect && ctx.slots && typeof ctx.slots.inject === "function") {\n\t\t  ctx.effect(() => ctx.slots.inject("shell.overlay", () => ctx.slots.register(\n\t\t    { name: "shell.overlay", id: "${PACKAGE_ID}/rope-dock", order: 100 },\n\t\t    () => React.createElement(RopeDock, null),\n\t\t  )));\n\t\t}\n\n\t\t// Settings first (host file, port-independent persistence replacing localStorage).`);
  const withLfaaCleanup = slottedDock.replace(apply[0]!, `${apply[0]}\n\t\tif (ctx.effect) ctx.effect(() => () => { try { ctx.get("theme")?.clearWallpaperEngineOverride?.(); } catch { /* ignore */ } });`);
  return withLfaaCleanup.replace(moduleExport[0]!, `// LFAA Cordis 要求以非构造回调加载具名 apply，才能托管其返回清理器。\n\t\texports.apply = (ctx, config) => apply(ctx, config);\n\t\texports.inject = inject;\n\t\treturn module.exports;`);
}

function verifySourceManifest(manifest: Record<string, unknown>, record: PluginRecord): void {
  const exports = asRecord(manifest.exports);
  const clientExport = asRecord(exports["./client"]);
  const dsh = asRecord(manifest.dsh);
  const bundle = asRecord(dsh.bundle);
  const client = asRecord(dsh.client);
  if (manifest.name !== PACKAGE_ID || manifest.version !== record.version || manifest.main !== "lib/index.js"
    || bundle.patch !== "./cordis.patch.yml" || client.platform !== "web"
    || !Array.isArray(client.inject) || client.inject.length !== 1 || client.inject[0] !== "@deepseek-ai/dsh-client-runtime"
    || clientExport.default !== "./lib/client.js") {
    throw new Error("Wallpaper Engine 插件清单与已核验安装记录或 DSH v1 兼容合同不匹配。");
  }
}

function adaptHostSource(source: string): string {
  const needed = findHostFunction(source, "mediaOriginNeeded");
  const scene = findHostFunction(source, "ensureSceneMediaOrigin");
  const info = findHostFunction(source, "mediaOriginInfo");
  const mediaOrigin = findHostFunction(source, "ensureMediaOrigin");
  const sceneFiles = findHostFunction(source, "handleSceneFiles", "req, res, mount");
  const pluginExport = source.match(/^export default \{ inject, apply \};$/gmu) ?? [];
  const mediaOriginAnchors = [
    "createServer((req, res) => {",
    "if (pathname === '/diag' || pathname === `${BASE}/diag`)",
    "if (!pathname.startsWith(`${BASE}/scene-files/`))",
    "handleSceneFiles(req, res, 'media');",
    "server.listen(0, '127.0.0.1'",
    "mediaOrigin = { server, port, base: `http://127.0.0.1:${port}` }",
    "server.on('error', unavailable);",
  ];
  const sceneFilesAnchors = [
    "const abs = mediaMap.get(token);",
    "const root = dirname(abs);",
    "const target = resolve(root, subpath);",
    "if (target === root || !target.startsWith(root + sep))",
    "linked = lstatSync(target).isSymbolicLink();",
    "realTarget = realpathSync.native(target);",
    "realRoot = realpathSync.native(root);",
    "realTarget.startsWith(realRoot + sep)",
    "serveFile(target, req, res, method === 'HEAD'",
  ];
  const missingAnchors = [
    ...(needed.length !== 1 || !needed[0]!.includes("adapterFenceSeen") || !needed[0]!.includes("adapterShellSeen") ? ["mediaOriginNeeded"] : []),
    ...(scene.length !== 1 || !scene[0]!.includes("ensureMediaOrigin") ? ["ensureSceneMediaOrigin"] : []),
    ...(info.length !== 1 || !info[0]!.includes("ensureMediaOrigin") ? ["mediaOriginInfo"] : []),
    ...(mediaOrigin.length !== 1 ? ["ensureMediaOrigin"] : mediaOriginAnchors.filter((anchor) => !mediaOrigin[0]!.includes(anchor))),
    ...(sceneFiles.length !== 1 ? ["handleSceneFiles"] : sceneFilesAnchors.filter((anchor) => !sceneFiles[0]!.includes(anchor))),
    ...(!source.includes("disposers.push(() => { try { mediaOrigin?.server?.close(); } catch { /* ignore */ } });") ? ["mediaOrigin Fiber disposer"] : []),
    ...(pluginExport.length !== 1 ? ["default Host export"] : []),
  ];
  if (missingAnchors.length) {
    throw new Error(`固定 Wallpaper Engine Host 的 Scene 媒体边界锚点不匹配，拒绝启用：${missingAnchors.join("、")}`);
  }
  // LFAA 只允许现有 WebServer 监听器：Scene 与网页资源都复用认证的同源 /scene-files 路由。
  // 先验证官方临时监听器、诊断、文件围栏和 Fiber 清理结构，再在运行副本中关闭整个媒体源，
  // 使 inventory 和诊断调用都无法启动第二个端口。空 mediaBase 由上游 Client 回落到当前 origin。
  let adapted = source.replace(needed[0]!, "function mediaOriginNeeded() { return false; }");
  adapted = adapted.replace(scene[0]!, "function ensureSceneMediaOrigin() { return Promise.resolve(\"\"); }");
  adapted = adapted.replace(info[0]!, "function mediaOriginInfo() { return Promise.resolve({ base: null, port: null }); }");
  adapted = adapted.replace(mediaOrigin[0]!, "function ensureMediaOrigin() { return Promise.resolve(null); }");
  return adapted.replace(pluginExport[0]!, "export default { inject, apply: (ctx, config) => apply(ctx, config) };");
}

function adaptSceneServeSource(source: string): string {
  const sceneRoute = source.match(/^[\t ]*path: `\$\{BASE\}\/scene-live`,$/gmu) ?? [];
  const sceneFence = source.match(/^[\t ]*if \(abs === WEBWALLGL_DIR \|\| !abs\.startsWith\(WEBWALLGL_DIR \+ sep\)\) \{$/gmu) ?? [];
  const htmlCacheHeader = source.match(/^[\t ]*res\.setHeader\('Cache-Control', rest === 'index\.html' \|\| rest === 'default-wallpaper\/index\.html'$/gmu) ?? [];
  const serveFile = source.match(/^[\t ]*serveFile\(abs, req, res, method === 'HEAD'\);$/gmu) ?? [];
  if (sceneRoute.length !== 1 || sceneFence.length !== 1 || htmlCacheHeader.length !== 1 || serveFile.length !== 1
    || source.includes("X-Frame-Options")) {
    throw new Error("固定 Wallpaper Engine Scene Renderer 路由的同源帧策略/资源围栏锚点不匹配，拒绝启用。");
  }
  // 仅 iframe 文档需要同源嵌入；站点中间件其余响应继续保持 X-Frame-Options: DENY。
  const indent = htmlCacheHeader[0]!.match(/^[\t ]*/u)?.[0] ?? "";
  return source.replace(htmlCacheHeader[0]!, `${indent}if (rest === 'index.html') res.setHeader('X-Frame-Options', 'SAMEORIGIN');\n${htmlCacheHeader[0]!}`);
}

/**
 * 读取 Host 内声明函数的完整代码块。函数体可能含有对象字面量或嵌套回调，不能在第一个 `}` 处截断；
 * 匹配要求函数声明后换行并在同缩进层闭合，防止压成单行时吞掉相邻函数；格式变化由 inspectSnapshot 失败关闭。
 */
function findHostFunction(source: string, name: string, parameters = ""): string[] {
  return source.match(new RegExp(`^([\\t ]*)function ${name}\\(${parameters}\\) \\{\\r?\\n(?:(?!^\\1function\\b)[\\s\\S])*?^\\1\\}`, "gmu")) ?? [];
}

function copyRuntimeFiles(source: string, destination: string): void {
  const allowedRootFiles = new Set(["package.json", "cordis.patch.yml"]);
  const visit = (from: string, to: string, rel = ""): void => {
    for (const name of readdirSync(from)) {
      const childRel = rel ? `${rel}/${name}` : name;
      if (!rel && !allowedRootFiles.has(name) && name !== "lib") continue;
      if (childRel.startsWith("lib/") && childRel.split("/").some((part) => part === "node_modules" || part === ".git")) continue;
      const fromPath = resolve(from, name);
      const toPath = resolve(to, name);
      if (!toPath.startsWith(`${destination}${sep}`)) throw new Error("Wallpaper Engine 运行副本路径越界。");
      const info = lstatSync(fromPath);
      if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) throw new Error(`Wallpaper Engine 源文件类型不受支持：${childRel}`);
      if (info.isDirectory()) { mkdirSync(toPath, { recursive: true, mode: 0o700 }); visit(fromPath, toPath, childRel); }
      else { mkdirSync(dirname(toPath), { recursive: true, mode: 0o700 }); copyFileSync(fromPath, toPath); }
    }
  };
  visit(source, destination);
}

function runtimeContentDigest(root: string): string {
  const base = resolve(root);
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory).sort()) {
      if (directory === base && entry === "lfaa-runtime-adapter.json") continue;
      const path = resolve(directory, entry);
      const info = lstatSync(path);
      if (info.isSymbolicLink()) throw new Error("Wallpaper Engine Runtime 副本不能包含符号链接。");
      if (info.isDirectory()) visit(path);
      else if (info.isFile()) files.push(path);
      else throw new Error("Wallpaper Engine Runtime 副本含不支持的文件类型。");
    }
  };
  visit(base);
  const digest = createHash("sha256");
  for (const file of files.sort()) {
    digest.update(resolve(base, file).slice(base.length + 1).replaceAll("\\", "/"));
    digest.update("\0");
    digest.update(readFileSync(file));
    digest.update("\0");
  }
  return digest.digest("hex");
}

async function readRequestBody(request: import("express").Request, response: import("express").Response): Promise<Buffer | null> {
  const declaredLength = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > BODY_LIMIT) {
    response.status(413).json({ error: "settings payload too large" });
    request.resume();
    return null;
  }
  return await new Promise<Buffer | null>((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
      request.off("aborted", onAbort);
      response.off("close", onClose);
    };
    const finish = (body: Buffer | null, error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error); else resolveBody(body);
    };
    const armIdleTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        finish(null);
        if (!response.headersSent && !response.destroyed) response.status(408).json({ error: "request timeout" });
        request.resume();
      }, BODY_IDLE_TIMEOUT_MS);
    };
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > BODY_LIMIT) {
        finish(null);
        if (!response.headersSent && !response.destroyed) response.status(413).json({ error: "settings payload too large" });
        request.resume();
        return;
      }
      chunks.push(bytes);
      armIdleTimeout();
    };
    const onEnd = () => finish(Buffer.concat(chunks, size));
    const onError = (error: Error) => finish(null, error);
    const onAbort = () => finish(null, new Error("Wallpaper Engine Settings 请求已中断。"));
    const onClose = () => { if (!response.writableEnded) finish(null, new Error("Wallpaper Engine Settings 响应已关闭。")); };
    timer = setTimeout(() => undefined, BODY_IDLE_TIMEOUT_MS);
    request.on("data", onData);
    request.once("end", onEnd);
    request.once("error", onError);
    request.once("aborted", onAbort);
    response.once("close", onClose);
    armIdleTimeout();
  });
}

function withSyntheticBody(request: import("express").Request, body: Buffer): import("express").Request {
  const stream = Readable.from([body]);
  return new Proxy(request, {
    get(target, property, receiver) {
      if (["on", "once", "off", "removeListener", "read", "resume", "pause", "pipe", "unpipe", "destroy", "readableEnded", "readable"].includes(String(property))) {
        const value = Reflect.get(stream, property, stream);
        return typeof value === "function" ? value.bind(stream) : value;
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as typeof request;
}

function withJsonTransform(
  response: import("express").Response,
  transform: (payload: Record<string, unknown>) => Record<string, unknown>,
): import("express").Response {
  const end = response.end.bind(response);
  const proxyResponse = new Proxy(response, {
    get(target, property, receiver) {
      if (property === "end") return (chunk?: unknown, ...args: unknown[]) => {
        if (typeof chunk === "string" || Buffer.isBuffer(chunk)) {
          let payload: unknown;
          try {
            payload = JSON.parse(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk) as unknown;
          } catch { /* Non-JSON routes retain their upstream response bytes. */ }
          if (isRecord(payload)) {
            try { chunk = Buffer.from(JSON.stringify(transform(payload)), "utf8"); }
            catch {
              target.statusCode = 500;
              target.setHeader("Content-Type", "application/json; charset=utf-8");
              chunk = Buffer.from(JSON.stringify({ error: "settings persistence failed" }), "utf8");
            }
          }
        }
        return end(chunk as never, ...args as never[]);
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, property, value) { return Reflect.set(target, property, value, target); },
  });
  return proxyResponse;
}

function overlayAccountSelection(payload: Record<string, unknown>, userId: string, requestedId?: string): Record<string, unknown> {
  const settings = isRecord(payload.settings) ? payload.settings : null;
  if (!settings) return payload;
  const account = getUserSettings(userId).appearance.wallpaperEngine;
  return { ...payload, settings: { ...settings, id: requestedId ?? (account.enabled ? account.projectId : "") } };
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
function isSafeWallpaperProjectId(value: string): boolean { return value === "" || value.length <= 180 && /^[A-Za-z0-9_-]+$/u.test(value); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function asRecord(value: unknown): Record<string, unknown> { return isRecord(value) ? value : {}; }

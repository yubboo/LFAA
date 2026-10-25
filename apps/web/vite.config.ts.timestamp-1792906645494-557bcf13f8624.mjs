// vite.config.ts
import { dirname as dirname2, resolve as resolve4 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { readFileSync as readFileSync3 } from "node:fs";
import { createLogger, defineConfig, loadEnv } from "file:///E:/lfaa1/lfaa/node_modules/.pnpm/vite@5.0.0_@types+node@24.19.0/node_modules/vite/dist/node/index.js";
import react from "file:///E:/lfaa1/lfaa/node_modules/.pnpm/@vitejs+plugin-react@4.3.4__5f06f52f4cb827dc6e78f03015c18290/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { renderIndexInjections } from "file:///E:/lfaa1/lfaa/node_modules/.pnpm/@deepseek-ai+dsh-host-webse_6c4a729a162be4879a14aae06b255ea6/node_modules/@deepseek-ai/dsh-host-webserver/lib/index.js";

// src/dev-proxy.ts
function createHarnessDevProxy(target, configure) {
  const route = () => ({ target, configure });
  return {
    "/__dsh": route(),
    "/plugins": route(),
    "/wallpaper-engine": route(),
    "/api": route(),
    "/socket.io": { ...route(), ws: true }
  };
}

// ../../scripts/harness-workspace.mjs
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
function workspacePackages(root2) {
  return readdirSync(resolve(root2, "packages")).flatMap((group) => readdirSync(resolve(root2, "packages", group)).flatMap((entry) => {
    const path = `packages/${group}/${entry}`;
    const manifest = resolve(root2, path, "package.json");
    return existsSync(manifest) ? [{ path, ...JSON.parse(readFileSync(manifest, "utf8")) }] : [];
  }));
}
function workspaceAliases(root2) {
  return workspacePackages(root2).flatMap((pkg) => {
    const entry = workspaceSourceEntry(root2, pkg);
    return [
      { find: `${pkg.name}/src`, replacement: resolve(root2, pkg.path, "src") },
      ...entry ? [{ find: pkg.name, replacement: resolve(root2, pkg.path, entry) }] : []
    ];
  });
}
function workspaceSourceEntry(root2, pkg) {
  const declared = pkg.exports?.["."];
  const entry = typeof declared === "string" ? declared : declared?.import ?? declared?.default;
  if (typeof entry === "string")
    return entry.replace(/^\.\//u, "");
  return ["src/index.ts", "src/index.tsx", "src/index.mjs"].find((path) => existsSync(resolve(root2, pkg.path, path)));
}

// ../../scripts/runtime-build-state.mjs
import { createHash } from "node:crypto";
import { existsSync as existsSync2, readFileSync as readFileSync2, readdirSync as readdirSync2, lstatSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve as resolve2, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
var __vite_injected_original_import_meta_url = "file:///E:/lfaa1/lfaa/scripts/runtime-build-state.mjs";
var root = resolve2(dirname(fileURLToPath(__vite_injected_original_import_meta_url)), "..");
var excluded = /* @__PURE__ */ new Set(["node_modules", "data", "dist", "target", "gen", ".git"]);
var outputs = { host: "dist/apps/control-plane", web: "dist/apps/web" };
var requiredOutputs = {
  host: ["index.js", "workspace.json", "packages/boot/app-boot/src/index.js"],
  web: ["index.html"]
};
function inputs(repository, kind) {
  const files = [];
  function walk(path) {
    if (!existsSync2(path))
      return;
    const info = lstatSync(path);
    if (info.isSymbolicLink())
      return;
    if (!info.isDirectory()) {
      files.push(path);
      return;
    }
    for (const entry of readdirSync2(path).sort()) {
      if (excluded.has(entry))
        continue;
      if (relative(repository, path).replaceAll("\\", "/") === "apps/web" && /^vite\.config\.ts\.timestamp-\d+-[a-f0-9]+\.mjs$/u.test(entry))
        continue;
      walk(resolve2(path, entry));
    }
  }
  for (const path of ["package.json", "pnpm-lock.yaml", `tsconfig.${kind === "host" ? "host" : "client"}.json`, "scripts/harness-workspace.mjs", "scripts/runtime-build-state.mjs"])
    walk(resolve2(repository, path));
  walk(resolve2(repository, kind === "host" ? "scripts/build-harness.mjs" : "apps/web"));
  if (kind === "host") {
    walk(resolve2(repository, "apps/cli/src"));
    walk(resolve2(repository, "apps/cli/config"));
  }
  for (const group of readdirSync2(resolve2(repository, "packages"))) {
    if (group === "test-support" || kind === "host" && group === "client")
      continue;
    for (const name of readdirSync2(resolve2(repository, "packages", group))) {
      const path = resolve2(repository, "packages", group, name);
      if (existsSync2(resolve2(path, "package.json")))
        walk(path);
    }
  }
  return files.sort();
}
function runtimeBuildFingerprint(kind, repository = root) {
  if (!outputs[kind])
    throw new Error("\u672A\u77E5\u6784\u5EFA\u804C\u8D23\u3002");
  const hash = createHash("sha256");
  for (const file of inputs(repository, kind)) {
    hash.update(relative(repository, file).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync2(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}
function recordRuntimeBuild(kind, repository = root, expectedFingerprint, outputDirectory) {
  const fingerprint = runtimeBuildFingerprint(kind, repository);
  if (expectedFingerprint !== void 0 && fingerprint !== expectedFingerprint)
    throw new Error("\u6784\u5EFA\u671F\u95F4\u6E90\u7801\u53D1\u751F\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u6784\u5EFA\uFF0C\u907F\u514D\u8BB0\u5F55\u8FC7\u671F\u8F93\u51FA\u3002");
  const output = outputDirectory === void 0 ? resolve2(repository, outputs[kind]) : resolve2(repository, outputDirectory);
  const distRoot = resolve2(repository, "dist");
  const relativeOutput = relative(distRoot, output);
  if (!relativeOutput || relativeOutput === ".." || relativeOutput.startsWith(`..${sep}`)) {
    throw new Error(`\u6784\u5EFA\u6307\u7EB9\u53EA\u5141\u8BB8\u5199\u5165\u4ED3\u5E93\u6839 dist/ \u4E0B\u7684\u8F93\u51FA\u76EE\u5F55\uFF1A${output}`);
  }
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve2(output, "build-state.json"), JSON.stringify({ kind, fingerprint }));
}
function staleRuntimeBuilds(profile = "web", repository = root) {
  return (profile === "web" ? ["host", "web"] : ["host"]).filter((kind) => {
    const output = resolve2(repository, outputs[kind]);
    if (requiredOutputs[kind].some((path) => !existsSync2(resolve2(output, path))))
      return true;
    if (kind === "web") {
      const html = readFileSync2(resolve2(output, "index.html"), "utf8");
      const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gu)].map(([, path]) => path).filter((path) => path.startsWith("/assets/"));
      if (!assets.length || assets.some((path) => !existsSync2(resolve2(output, `.${path}`))))
        return true;
    }
    try {
      return JSON.parse(readFileSync2(resolve2(output, "build-state.json"), "utf8")).fingerprint !== runtimeBuildFingerprint(kind, repository);
    } catch {
      return true;
    }
  });
}
if (process.argv[1] && resolve2(process.argv[1]) === fileURLToPath(__vite_injected_original_import_meta_url)) {
  process.stdout.write(`${JSON.stringify(staleRuntimeBuilds(process.argv[2]))}
`);
}

// scripts/web-asset-retention.mjs
import { readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve as resolve3 } from "node:path";
var HISTORY_FILENAME = ".lfaa-web-asset-history.json";
var MAX_RETAINED_GENERATIONS = 3;
var VERSIONED_ASSET_PATH = /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|avif|gif|wasm|map)$/iu;
function normalizeAssetPaths(paths) {
  if (!Array.isArray(paths))
    return [];
  return [...new Set(paths.filter((path) => typeof path === "string").map((path) => path.replaceAll("\\", "/")).filter((path) => VERSIONED_ASSET_PATH.test(path)))].sort();
}
async function listExistingVersionedAssets(outputDirectory) {
  let entries;
  try {
    entries = await readdir(resolve3(outputDirectory, "assets"), { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
  return entries.filter((entry) => entry.isFile() && VERSIONED_ASSET_PATH.test(`assets/${entry.name}`)).map((entry) => `assets/${entry.name}`).sort();
}
async function readWebAssetHistory(outputDirectory) {
  const historyPath = resolve3(outputDirectory, HISTORY_FILENAME);
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
    throw new Error(`Web \u8D44\u6E90\u4FDD\u7559\u8BB0\u5F55\u635F\u574F\uFF0C\u4E3A\u907F\u514D\u8BEF\u5220\u5DF2\u6253\u5F00\u9875\u9762\u8D44\u6E90\u800C\u505C\u6B62\u6784\u5EFA\uFF1A${historyPath}`, { cause: error });
  }
  if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.generations)) {
    throw new Error(`Web \u8D44\u6E90\u4FDD\u7559\u8BB0\u5F55\u683C\u5F0F\u4E0D\u53D7\u652F\u6301\uFF0C\u4E3A\u907F\u514D\u8BEF\u5220\u65E7\u9875\u9762\u8D44\u6E90\u800C\u505C\u6B62\u6784\u5EFA\uFF1A${historyPath}`);
  }
  return parsed.generations.filter(Array.isArray).map(normalizeAssetPaths).filter((generation) => generation.length > 0).slice(0, MAX_RETAINED_GENERATIONS - 1);
}
async function retainWebAssetGenerations(outputDirectory, currentAssetPaths, previousGenerations = []) {
  const current = normalizeAssetPaths(currentAssetPaths);
  if (current.length === 0)
    throw new Error("Web \u6784\u5EFA\u6CA1\u6709\u751F\u6210\u5E26\u54C8\u5E0C\u8D44\u6E90\uFF0C\u5DF2\u505C\u6B62\u5386\u53F2\u8D44\u6E90\u6E05\u7406\u3002");
  const generations = [
    current,
    ...previousGenerations.filter(Array.isArray).map(normalizeAssetPaths).filter((generation) => generation.length > 0)
  ].slice(0, MAX_RETAINED_GENERATIONS);
  const retained = new Set(generations.flat());
  const historyPath = resolve3(outputDirectory, HISTORY_FILENAME);
  const temporaryHistoryPath = `${historyPath}.tmp`;
  await writeFile(temporaryHistoryPath, `${JSON.stringify({ schemaVersion: 1, generations }, null, 2)}
`, "utf8");
  await rename(temporaryHistoryPath, historyPath);
  const entries = await readdir(resolve3(outputDirectory, "assets"), { withFileTypes: true });
  const removed = [];
  for (const entry of entries) {
    const assetPath = `assets/${entry.name}`;
    if (!entry.isFile() || !VERSIONED_ASSET_PATH.test(assetPath) || retained.has(assetPath))
      continue;
    await unlink(resolve3(outputDirectory, assetPath));
    removed.push(assetPath);
  }
  return { generations, removed };
}
function createWebAssetRetentionPlugin(repositoryRoot2) {
  let outputDirectory = "";
  let isActiveWebOutput = false;
  let previousGenerations = [];
  return {
    name: "lfaa-web-asset-retention",
    apply: "build",
    configResolved(config) {
      outputDirectory = config.build.outDir;
      isActiveWebOutput = resolve3(config.root, outputDirectory) === resolve3(repositoryRoot2, "dist", "apps", "web");
    },
    async buildStart() {
      previousGenerations = isActiveWebOutput ? await readWebAssetHistory(outputDirectory) : [];
    },
    async writeBundle(_options, bundle) {
      if (!isActiveWebOutput)
        return;
      const currentAssets = Object.keys(bundle);
      const { generations, removed } = await retainWebAssetGenerations(outputDirectory, currentAssets, previousGenerations);
      this.info(`Web \u54C8\u5E0C\u8D44\u6E90\u4FDD\u7559 ${generations.length} \u4EE3\uFF0C\u6E05\u7406 ${removed.length} \u4E2A\u8FC7\u671F\u8D44\u6E90\u3002`);
    }
  };
}

// scripts/project-version.mjs
var STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
var RELEASE_FEED_SUFFIX = "/releases/latest/download";
function createProjectBuildMetadata({ projectPackage, webPackage, electronPackage, releaseManifest }) {
  const currentVersion = readStableVersion(projectPackage?.version, "apps/cli/package.json");
  for (const [manifest, label] of [
    [webPackage, "apps/web/package.json"],
    [electronPackage, "apps/desktop-electron/package.json"]
  ]) {
    if (readStableVersion(manifest?.version, label) !== currentVersion) {
      throw new Error(`\u9879\u76EE\u7248\u672C\u4E0D\u4E00\u81F4\uFF1A${label} \u5FC5\u987B\u4E0E apps/cli/package.json \u540C\u4E3A ${currentVersion}\u3002`);
    }
  }
  const repositoryUrl = projectPackage?.repository?.url;
  if (typeof repositoryUrl !== "string")
    throw new Error("apps/cli/package.json \u7F3A\u5C11 LFAA \u4ED3\u5E93\u5730\u5740\u3002");
  let parsedRepositoryUrl;
  try {
    parsedRepositoryUrl = new URL(repositoryUrl.startsWith("git+") ? repositoryUrl.slice(4) : repositoryUrl);
  } catch {
    throw new Error("apps/cli/package.json \u4E2D\u7684 LFAA \u4ED3\u5E93\u5730\u5740\u65E0\u6548\u3002");
  }
  const repositoryParts = parsedRepositoryUrl.pathname.split("/").filter(Boolean);
  if (parsedRepositoryUrl.protocol !== "https:" || parsedRepositoryUrl.hostname !== "github.com" || parsedRepositoryUrl.username || parsedRepositoryUrl.password || parsedRepositoryUrl.search || parsedRepositoryUrl.hash || repositoryParts.length !== 2 || !/^[A-Za-z0-9_.-]+$/u.test(repositoryParts[0]) || !/^[A-Za-z0-9_.-]+(?:\.git)?$/u.test(repositoryParts[1])) {
    throw new Error("LFAA \u4ED3\u5E93\u5730\u5740\u5FC5\u987B\u662F GitHub \u4E0A\u7684 HTTPS owner/repository \u5730\u5740\u3002");
  }
  const [owner, repositoryWithSuffix] = repositoryParts;
  const repository = repositoryWithSuffix.replace(/\.git$/u, "");
  if (!repository)
    throw new Error("LFAA \u4ED3\u5E93\u540D\u79F0\u7F3A\u5931\u3002");
  const releasePage = `https://github.com/${owner}/${repository}/releases`;
  const feedUrl = `https://github.com/${owner}/${repository}${RELEASE_FEED_SUFFIX}/`;
  const announcement = readReleaseAnnouncement(releaseManifest, currentVersion);
  return Object.freeze({
    currentVersion,
    publishedAt: announcement.publishedAt,
    releaseNotes: announcement.releaseNotes,
    updateManifestUrl: `https://raw.githubusercontent.com/${owner}/${repository}/main/update.json`,
    feedUrl,
    releasePage
  });
}
function readReleaseAnnouncement(manifest, currentVersion) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) || manifest.version !== currentVersion || manifest.title !== `LFAA ${currentVersion}`) {
    throw new Error("update.json \u5FC5\u987B\u63D0\u4F9B\u4E0E\u5F53\u524D\u4EA7\u54C1\u7248\u672C\u4E00\u81F4\u7684\u516C\u544A\u5185\u5BB9\u3002");
  }
  const publishedAt = manifest.publishedAt;
  if (typeof publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(publishedAt) || Number.isNaN(Date.parse(`${publishedAt}T00:00:00Z`)) || (/* @__PURE__ */ new Date(`${publishedAt}T00:00:00Z`)).toISOString().slice(0, 10) !== publishedAt) {
    throw new Error("update.json \u516C\u544A\u53D1\u5E03\u65E5\u671F\u65E0\u6548\u3002");
  }
  const releaseNotes = manifest.releaseNotes;
  if (!Array.isArray(releaseNotes) || releaseNotes.length < 1 || releaseNotes.length > 32 || releaseNotes.some((note) => typeof note !== "string" || !note.trim()) || releaseNotes.reduce((total, note) => total + note.length, 0) > 12e3) {
    throw new Error("update.json \u516C\u544A\u5185\u5BB9\u5FC5\u987B\u662F 1 \u81F3 32 \u6761\u975E\u7A7A\u6587\u672C\uFF0C\u5408\u8BA1\u4E0D\u8D85\u8FC7 12000 \u5B57\u7B26\u3002");
  }
  return Object.freeze({ publishedAt, releaseNotes: Object.freeze(releaseNotes.map((note) => note.trim())) });
}
function readStableVersion(value, label) {
  if (typeof value !== "string" || !STABLE_VERSION_PATTERN.test(value) || value.split(".").some((part) => !Number.isSafeInteger(Number(part)))) {
    throw new Error(`${label} \u5FC5\u987B\u58F0\u660E\u7A33\u5B9A\u7248 x.y.z \u9879\u76EE\u7248\u672C\u3002`);
  }
  return value;
}

// vite.config.ts
var __vite_injected_original_import_meta_url2 = "file:///E:/lfaa1/lfaa/apps/web/vite.config.ts";
var repositoryRoot = resolve4(dirname2(fileURLToPath2(__vite_injected_original_import_meta_url2)), "../..");
var projectBuildMetadata = createProjectBuildMetadata({
  projectPackage: JSON.parse(readFileSync3(resolve4(repositoryRoot, "apps/cli/package.json"), "utf8")),
  webPackage: JSON.parse(readFileSync3(resolve4(repositoryRoot, "apps/web/package.json"), "utf8")),
  electronPackage: JSON.parse(readFileSync3(resolve4(repositoryRoot, "apps/desktop-electron/package.json"), "utf8")),
  releaseManifest: JSON.parse(readFileSync3(resolve4(repositoryRoot, "update.json"), "utf8"))
});
function createBackendProxyLogger() {
  const viteLogger = createLogger();
  let backendUnavailable = false;
  return {
    logger: {
      get hasWarned() {
        return viteLogger.hasWarned;
      },
      info: viteLogger.info.bind(viteLogger),
      warn: viteLogger.warn.bind(viteLogger),
      warnOnce: viteLogger.warnOnce.bind(viteLogger),
      clearScreen: viteLogger.clearScreen.bind(viteLogger),
      hasErrorLogged: viteLogger.hasErrorLogged.bind(viteLogger),
      error(message, options) {
        const errorCode = options?.error && "code" in options.error ? options.error.code : void 0;
        const isBackendConnectionRefused = errorCode === "ECONNREFUSED" && (message.includes("http proxy error") || message.includes("ws proxy error"));
        if (!isBackendConnectionRefused) {
          viteLogger.error(message, options);
          return;
        }
        if (!backendUnavailable) {
          backendUnavailable = true;
          viteLogger.warn("LFAA \u63A7\u5236\u7AEF\u8FDE\u63A5\u6682\u4E0D\u53EF\u7528\uFF1B\u540C\u4E00\u6545\u969C\u671F\u95F4\u7684\u91CD\u590D Vite \u4EE3\u7406\u9519\u8BEF\u5DF2\u5408\u5E76\u3002", { timestamp: true });
        }
      }
    },
    markBackendAvailable() {
      if (!backendUnavailable)
        return;
      backendUnavailable = false;
      viteLogger.info("LFAA \u63A7\u5236\u7AEF\u8FDE\u63A5\u5DF2\u6062\u590D\u3002", { timestamp: true });
    }
  };
}
var vite_config_default = defineConfig(({ mode }) => {
  const fileEnvironment = loadEnv(mode, repositoryRoot, "");
  const serverPort = process.env.SERVER_PORT?.trim() || fileEnvironment.SERVER_PORT || "3000";
  if (!/^\d{1,5}$/u.test(serverPort) || Number(serverPort) < 1 || Number(serverPort) > 65535) {
    throw new Error("SERVER_PORT \u5FC5\u987B\u662F 1\u201365535 \u4E4B\u95F4\u7684\u7AEF\u53E3\u53F7\u3002");
  }
  const serverTarget = `http://127.0.0.1:${serverPort}`;
  const backendProxyLogger = createBackendProxyLogger();
  const dshBootstrap = {
    name: "lfaa-dsh-dev-bootstrap",
    apply: "serve",
    transformIndexHtml: {
      order: "pre",
      async handler(html) {
        let lastError;
        for (let attempt = 0; attempt < 12; attempt += 1) {
          try {
            const response = await fetch(`${serverTarget}/__dsh/index-injections`);
            if (response.ok) {
              const injections = await response.json();
              if (!Array.isArray(injections))
                throw new Error("DSH Host \u8FD4\u56DE\u7684\u9875\u9762\u6CE8\u5165\u4E0D\u662F\u5217\u8868\u3002");
              return renderIndexInjections(html, injections);
            }
            lastError = new Error(`DSH Host \u9875\u9762\u6CE8\u5165\u8FD4\u56DE HTTP ${response.status}\u3002`);
          } catch (error) {
            lastError = error;
          }
          await new Promise((resolveRetry) => setTimeout(resolveRetry, 250));
        }
        throw new Error("Vite \u65E0\u6CD5\u53D6\u5F97\u5DF2\u88C5\u914D\u7684 DSH Client Runtime \u542F\u52A8\u56FE\u3002", { cause: lastError });
      }
    }
  };
  let sourceFingerprint;
  let writesActiveRuntime;
  let webOutputDirectory;
  const markBackendAvailable = (proxy) => {
    proxy.on("proxyRes", backendProxyLogger.markBackendAvailable);
    proxy.on("open", backendProxyLogger.markBackendAvailable);
  };
  return {
    customLogger: backendProxyLogger.logger,
    plugins: [dshBootstrap, react(), createWebAssetRetentionPlugin(repositoryRoot), {
      name: "lfaa-build-state",
      apply: "build",
      configResolved(config) {
        webOutputDirectory = resolve4(config.root, config.build.outDir);
        writesActiveRuntime = webOutputDirectory === resolve4(repositoryRoot, "dist/apps/web");
      },
      buildStart() {
        sourceFingerprint = runtimeBuildFingerprint("web", repositoryRoot);
      },
      writeBundle() {
        if (writesActiveRuntime) {
          recordRuntimeBuild("web", repositoryRoot, sourceFingerprint);
        } else if (webOutputDirectory === resolve4(repositoryRoot, "dist/.tmp/desktop-electron/web-candidate")) {
          recordRuntimeBuild("web", repositoryRoot, sourceFingerprint, webOutputDirectory);
        }
      }
    }],
    resolve: {
      alias: [
        ...workspaceAliases(repositoryRoot),
        { find: /^node:module$/u, replacement: resolve4(repositoryRoot, "apps/web/src/node-module-stub.ts") }
      ]
    },
    define: {
      __LFAA_PROJECT_BUILD_INFO__: JSON.stringify(projectBuildMetadata),
      // Match DSH's browser build: Cordis Loader's Node-only internal loader
      // stays unreachable while its client-side internal slot is supplied
      // by the DSH module graph at boot.
      "process.versions.node": '"0.0.0"',
      "process.execArgv": "[]",
      "process.env.CORDIS_SHARED": "undefined"
    },
    build: {
      target: "es2022",
      outDir: "../../dist/apps/web",
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replace(/\\/gu, "/");
            if (moduleId.includes("/simple-icons/"))
              return "vendor-simple-icons";
            if (moduleId.includes("/katex/"))
              return "vendor-katex";
            if (moduleId.includes("/react-dom/"))
              return "vendor-react-dom";
            if (moduleId.includes("/@shikijs/langs/dist/cpp-macro.mjs"))
              return "vendor-syntax-cpp-macro";
            if (moduleId.includes("/@shikijs/langs/dist/regexp.mjs"))
              return "vendor-syntax-regexp";
            if (["/dist/typescript.mjs", "/dist/shellscript.mjs", "/dist/json.mjs"].some((fileName) => moduleId.includes(`/@shikijs/langs${fileName}`)))
              return "vendor-syntax-basics";
            if (moduleId.includes("/shiki/") || moduleId.includes("/@shikijs/") && !moduleId.includes("/@shikijs/langs/"))
              return "vendor-syntax-core";
            if (["/micromark/", "/micromark-", "/mdast-util-", "/hast-util-", "/unist-util-", "/property-information/"].some((packagePath) => moduleId.includes(packagePath)))
              return "vendor-markdown";
            if (moduleId.includes("/@deepseek-ai/dsh-client-ui-primitives/"))
              return "dsh-ui-primitives";
            if (moduleId.includes("/@deepseek-ai/dsh-client-ui-dockkit/"))
              return "dsh-ui-dockkit";
            return void 0;
          }
        }
      },
      // 正式目录由资源保留插件按构建代数清理；显式临时输出仍由 Vite 独立清空。
      emptyOutDir: process.argv.some((argument) => argument === "--outDir" || argument.startsWith("--outDir="))
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: createHarnessDevProxy(serverTarget, markBackendAvailable)
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL2Rldi1wcm94eS50cyIsICIuLi8uLi9zY3JpcHRzL2hhcm5lc3Mtd29ya3NwYWNlLm1qcyIsICIuLi8uLi9zY3JpcHRzL3J1bnRpbWUtYnVpbGQtc3RhdGUubWpzIiwgInNjcmlwdHMvd2ViLWFzc2V0LXJldGVudGlvbi5tanMiLCAic2NyaXB0cy9wcm9qZWN0LXZlcnNpb24ubWpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRTpcXFxcbGZhYTFcXFxcbGZhYVxcXFxhcHBzXFxcXHdlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxcbGZhYTFcXFxcbGZhYVxcXFxhcHBzXFxcXHdlYlxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRTovbGZhYTEvbGZhYS9hcHBzL3dlYi92aXRlLmNvbmZpZy50c1wiOy8qKlxyXG4gKiBcdTUyOUZcdTgwRkRcdUZGMUFcdTkxNERcdTdGNkUgTEZBQSBXZWIgXHU1MjREXHU3QUVGXHU1RjAwXHU1M0QxXHU2NzBEXHU1MkExXHU1NjY4XHU1NDhDXHU3NTFGXHU0RUE3XHU2Nzg0XHU1RUZBXHUzMDAyXHJcbiAqIFx1NEY1Q1x1NzUyOFx1RkYxQVx1NTQyRlx1NzUyOCBSZWFjdCBcdThGNkNcdTYzNjJcdUZGMENcdTVFNzZcdTVDMDZcdTY3MkNcdTY3M0FcdTVGMDBcdTUzRDFcdTY1RjZcdTc2ODQgQVBJIFx1OEJGN1x1NkM0Mlx1NEVFM1x1NzQwNlx1NTIzMFx1NjNBN1x1NTIzNlx1N0FFRlx1MzAwMlxyXG4gKiBcdTUxNzNcdTgwNTRcdTY1ODdcdTRFRjZcdUZGMUFhcHBzL3dlYi9wYWNrYWdlLmpzb25cdTMwMDFwYWNrYWdlcy9jbGllbnQvd2ViL3NyYy9tYWluLnRzeFx1MzAwMXBhY2thZ2VzL2hvc3Qvd2Vic2VydmVyL3NyYy9zZXJ2ZXIudHNcdTMwMDJcclxuICovXHJcbmltcG9ydCB7IGRpcm5hbWUsIHJlc29sdmUgfSBmcm9tIFwibm9kZTpwYXRoXCI7XHJcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tIFwibm9kZTp1cmxcIjtcclxuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcclxuaW1wb3J0IHsgY3JlYXRlTG9nZ2VyLCBkZWZpbmVDb25maWcsIGxvYWRFbnYsIHR5cGUgTG9nZ2VyIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xyXG5pbXBvcnQgeyByZW5kZXJJbmRleEluamVjdGlvbnMgfSBmcm9tIFwiQGRlZXBzZWVrLWFpL2RzaC1ob3N0LXdlYnNlcnZlclwiO1xyXG5pbXBvcnQgeyBjcmVhdGVIYXJuZXNzRGV2UHJveHkgfSBmcm9tIFwiLi9zcmMvZGV2LXByb3h5LmpzXCI7XHJcbmltcG9ydCB7IHdvcmtzcGFjZUFsaWFzZXMgfSBmcm9tIFwiLi4vLi4vc2NyaXB0cy9oYXJuZXNzLXdvcmtzcGFjZS5tanNcIjtcclxuaW1wb3J0IHsgcmVjb3JkUnVudGltZUJ1aWxkLCBydW50aW1lQnVpbGRGaW5nZXJwcmludCB9IGZyb20gXCIuLi8uLi9zY3JpcHRzL3J1bnRpbWUtYnVpbGQtc3RhdGUubWpzXCI7XHJcbmltcG9ydCB7IGNyZWF0ZVdlYkFzc2V0UmV0ZW50aW9uUGx1Z2luIH0gZnJvbSBcIi4vc2NyaXB0cy93ZWItYXNzZXQtcmV0ZW50aW9uLm1qc1wiO1xyXG5pbXBvcnQgeyBjcmVhdGVQcm9qZWN0QnVpbGRNZXRhZGF0YSB9IGZyb20gXCIuL3NjcmlwdHMvcHJvamVjdC12ZXJzaW9uLm1qc1wiO1xyXG5cclxuY29uc3QgcmVwb3NpdG9yeVJvb3QgPSByZXNvbHZlKGRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKSwgXCIuLi8uLlwiKTtcclxuY29uc3QgcHJvamVjdEJ1aWxkTWV0YWRhdGEgPSBjcmVhdGVQcm9qZWN0QnVpbGRNZXRhZGF0YSh7XHJcbiAgcHJvamVjdFBhY2thZ2U6IEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKHJlc29sdmUocmVwb3NpdG9yeVJvb3QsIFwiYXBwcy9jbGkvcGFja2FnZS5qc29uXCIpLCBcInV0ZjhcIikpLFxyXG4gIHdlYlBhY2thZ2U6IEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKHJlc29sdmUocmVwb3NpdG9yeVJvb3QsIFwiYXBwcy93ZWIvcGFja2FnZS5qc29uXCIpLCBcInV0ZjhcIikpLFxyXG4gIGVsZWN0cm9uUGFja2FnZTogSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMocmVzb2x2ZShyZXBvc2l0b3J5Um9vdCwgXCJhcHBzL2Rlc2t0b3AtZWxlY3Ryb24vcGFja2FnZS5qc29uXCIpLCBcInV0ZjhcIikpLFxyXG4gIHJlbGVhc2VNYW5pZmVzdDogSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMocmVzb2x2ZShyZXBvc2l0b3J5Um9vdCwgXCJ1cGRhdGUuanNvblwiKSwgXCJ1dGY4XCIpKVxyXG59KTtcclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZUJhY2tlbmRQcm94eUxvZ2dlcigpOiB7IGxvZ2dlcjogTG9nZ2VyOyBtYXJrQmFja2VuZEF2YWlsYWJsZTogKCkgPT4gdm9pZCB9IHtcclxuICBjb25zdCB2aXRlTG9nZ2VyID0gY3JlYXRlTG9nZ2VyKCk7XHJcbiAgbGV0IGJhY2tlbmRVbmF2YWlsYWJsZSA9IGZhbHNlO1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgbG9nZ2VyOiB7XHJcbiAgICAgIGdldCBoYXNXYXJuZWQoKSB7XHJcbiAgICAgICAgcmV0dXJuIHZpdGVMb2dnZXIuaGFzV2FybmVkO1xyXG4gICAgICB9LFxyXG4gICAgICBpbmZvOiB2aXRlTG9nZ2VyLmluZm8uYmluZCh2aXRlTG9nZ2VyKSxcclxuICAgICAgd2Fybjogdml0ZUxvZ2dlci53YXJuLmJpbmQodml0ZUxvZ2dlciksXHJcbiAgICAgIHdhcm5PbmNlOiB2aXRlTG9nZ2VyLndhcm5PbmNlLmJpbmQodml0ZUxvZ2dlciksXHJcbiAgICAgIGNsZWFyU2NyZWVuOiB2aXRlTG9nZ2VyLmNsZWFyU2NyZWVuLmJpbmQodml0ZUxvZ2dlciksXHJcbiAgICAgIGhhc0Vycm9yTG9nZ2VkOiB2aXRlTG9nZ2VyLmhhc0Vycm9yTG9nZ2VkLmJpbmQodml0ZUxvZ2dlciksXHJcbiAgICAgIGVycm9yKG1lc3NhZ2UsIG9wdGlvbnMpIHtcclxuICAgICAgICBjb25zdCBlcnJvckNvZGUgPSBvcHRpb25zPy5lcnJvciAmJiBcImNvZGVcIiBpbiBvcHRpb25zLmVycm9yID8gb3B0aW9ucy5lcnJvci5jb2RlIDogdW5kZWZpbmVkO1xyXG4gICAgICAgIGNvbnN0IGlzQmFja2VuZENvbm5lY3Rpb25SZWZ1c2VkID0gZXJyb3JDb2RlID09PSBcIkVDT05OUkVGVVNFRFwiXHJcbiAgICAgICAgICAmJiAobWVzc2FnZS5pbmNsdWRlcyhcImh0dHAgcHJveHkgZXJyb3JcIikgfHwgbWVzc2FnZS5pbmNsdWRlcyhcIndzIHByb3h5IGVycm9yXCIpKTtcclxuXHJcbiAgICAgICAgaWYgKCFpc0JhY2tlbmRDb25uZWN0aW9uUmVmdXNlZCkge1xyXG4gICAgICAgICAgdml0ZUxvZ2dlci5lcnJvcihtZXNzYWdlLCBvcHRpb25zKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghYmFja2VuZFVuYXZhaWxhYmxlKSB7XHJcbiAgICAgICAgICBiYWNrZW5kVW5hdmFpbGFibGUgPSB0cnVlO1xyXG4gICAgICAgICAgdml0ZUxvZ2dlci53YXJuKFwiTEZBQSBcdTYzQTdcdTUyMzZcdTdBRUZcdThGREVcdTYzQTVcdTY2ODJcdTRFMERcdTUzRUZcdTc1MjhcdUZGMUJcdTU0MENcdTRFMDBcdTY1NDVcdTk2OUNcdTY3MUZcdTk1RjRcdTc2ODRcdTkxQ0RcdTU5MEQgVml0ZSBcdTRFRTNcdTc0MDZcdTk1MTlcdThCRUZcdTVERjJcdTU0MDhcdTVFNzZcdTMwMDJcIiwgeyB0aW1lc3RhbXA6IHRydWUgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgbWFya0JhY2tlbmRBdmFpbGFibGUoKSB7XHJcbiAgICAgIGlmICghYmFja2VuZFVuYXZhaWxhYmxlKSByZXR1cm47XHJcbiAgICAgIGJhY2tlbmRVbmF2YWlsYWJsZSA9IGZhbHNlO1xyXG4gICAgICB2aXRlTG9nZ2VyLmluZm8oXCJMRkFBIFx1NjNBN1x1NTIzNlx1N0FFRlx1OEZERVx1NjNBNVx1NURGMlx1NjA2Mlx1NTkwRFx1MzAwMlwiLCB7IHRpbWVzdGFtcDogdHJ1ZSB9KTtcclxuICAgIH1cclxuICB9O1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XHJcbiAgY29uc3QgZmlsZUVudmlyb25tZW50ID0gbG9hZEVudihtb2RlLCByZXBvc2l0b3J5Um9vdCwgXCJcIik7XHJcbiAgY29uc3Qgc2VydmVyUG9ydCA9IHByb2Nlc3MuZW52LlNFUlZFUl9QT1JUPy50cmltKCkgfHwgZmlsZUVudmlyb25tZW50LlNFUlZFUl9QT1JUIHx8IFwiMzAwMFwiO1xyXG4gIGlmICghL15cXGR7MSw1fSQvdS50ZXN0KHNlcnZlclBvcnQpIHx8IE51bWJlcihzZXJ2ZXJQb3J0KSA8IDEgfHwgTnVtYmVyKHNlcnZlclBvcnQpID4gNjU1MzUpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcihcIlNFUlZFUl9QT1JUIFx1NUZDNVx1OTg3Qlx1NjYyRiAxXHUyMDEzNjU1MzUgXHU0RTRCXHU5NUY0XHU3Njg0XHU3QUVGXHU1M0UzXHU1M0Y3XHUzMDAyXCIpO1xyXG4gIH1cclxuICBjb25zdCBzZXJ2ZXJUYXJnZXQgPSBgaHR0cDovLzEyNy4wLjAuMToke3NlcnZlclBvcnR9YDtcclxuICBjb25zdCBiYWNrZW5kUHJveHlMb2dnZXIgPSBjcmVhdGVCYWNrZW5kUHJveHlMb2dnZXIoKTtcclxuICBjb25zdCBkc2hCb290c3RyYXAgPSB7XHJcbiAgICBuYW1lOiBcImxmYWEtZHNoLWRldi1ib290c3RyYXBcIixcclxuICAgIGFwcGx5OiBcInNlcnZlXCIgYXMgY29uc3QsXHJcbiAgICB0cmFuc2Zvcm1JbmRleEh0bWw6IHtcclxuICAgICAgb3JkZXI6IFwicHJlXCIgYXMgY29uc3QsXHJcbiAgICAgIGFzeW5jIGhhbmRsZXIoaHRtbDogc3RyaW5nKSB7XHJcbiAgICAgICAgbGV0IGxhc3RFcnJvcjogdW5rbm93bjtcclxuICAgICAgICBmb3IgKGxldCBhdHRlbXB0ID0gMDsgYXR0ZW1wdCA8IDEyOyBhdHRlbXB0ICs9IDEpIHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7c2VydmVyVGFyZ2V0fS9fX2RzaC9pbmRleC1pbmplY3Rpb25zYCk7XHJcbiAgICAgICAgICAgIGlmIChyZXNwb25zZS5vaykge1xyXG4gICAgICAgICAgICAgIGNvbnN0IGluamVjdGlvbnM6IHVua25vd24gPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGluamVjdGlvbnMpKSB0aHJvdyBuZXcgRXJyb3IoXCJEU0ggSG9zdCBcdThGRDRcdTU2REVcdTc2ODRcdTk4NzVcdTk3NjJcdTZDRThcdTUxNjVcdTRFMERcdTY2MkZcdTUyMTdcdTg4NjhcdTMwMDJcIik7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIHJlbmRlckluZGV4SW5qZWN0aW9ucyhodG1sLCBpbmplY3Rpb25zKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBsYXN0RXJyb3IgPSBuZXcgRXJyb3IoYERTSCBIb3N0IFx1OTg3NVx1OTc2Mlx1NkNFOFx1NTE2NVx1OEZENFx1NTZERSBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfVx1MzAwMmApO1xyXG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgbGFzdEVycm9yID0gZXJyb3I7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZVJldHJ5KSA9PiBzZXRUaW1lb3V0KHJlc29sdmVSZXRyeSwgMjUwKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlZpdGUgXHU2NUUwXHU2Q0Q1XHU1M0Q2XHU1Rjk3XHU1REYyXHU4OEM1XHU5MTREXHU3Njg0IERTSCBDbGllbnQgUnVudGltZSBcdTU0MkZcdTUyQThcdTU2RkVcdTMwMDJcIiwgeyBjYXVzZTogbGFzdEVycm9yIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfTtcclxuICBsZXQgc291cmNlRmluZ2VycHJpbnQ6IHN0cmluZztcclxuICBsZXQgd3JpdGVzQWN0aXZlUnVudGltZTogYm9vbGVhbjtcclxuICBsZXQgd2ViT3V0cHV0RGlyZWN0b3J5OiBzdHJpbmc7XHJcbiAgY29uc3QgbWFya0JhY2tlbmRBdmFpbGFibGUgPSAocHJveHk6IHsgb246IChldmVudDogc3RyaW5nLCBsaXN0ZW5lcjogKCkgPT4gdm9pZCkgPT4gdW5rbm93biB9KSA9PiB7XHJcbiAgICBwcm94eS5vbihcInByb3h5UmVzXCIsIGJhY2tlbmRQcm94eUxvZ2dlci5tYXJrQmFja2VuZEF2YWlsYWJsZSk7XHJcbiAgICBwcm94eS5vbihcIm9wZW5cIiwgYmFja2VuZFByb3h5TG9nZ2VyLm1hcmtCYWNrZW5kQXZhaWxhYmxlKTtcclxuICB9O1xyXG5cclxuICByZXR1cm4ge1xyXG4gICAgY3VzdG9tTG9nZ2VyOiBiYWNrZW5kUHJveHlMb2dnZXIubG9nZ2VyLFxyXG4gICAgcGx1Z2luczogW2RzaEJvb3RzdHJhcCwgcmVhY3QoKSwgY3JlYXRlV2ViQXNzZXRSZXRlbnRpb25QbHVnaW4ocmVwb3NpdG9yeVJvb3QpLCB7XHJcbiAgICAgIG5hbWU6IFwibGZhYS1idWlsZC1zdGF0ZVwiLFxyXG4gICAgICBhcHBseTogXCJidWlsZFwiLFxyXG4gICAgICBjb25maWdSZXNvbHZlZChjb25maWcpIHtcclxuICAgICAgICB3ZWJPdXRwdXREaXJlY3RvcnkgPSByZXNvbHZlKGNvbmZpZy5yb290LCBjb25maWcuYnVpbGQub3V0RGlyKTtcclxuICAgICAgICB3cml0ZXNBY3RpdmVSdW50aW1lID0gd2ViT3V0cHV0RGlyZWN0b3J5ID09PSByZXNvbHZlKHJlcG9zaXRvcnlSb290LCBcImRpc3QvYXBwcy93ZWJcIik7XHJcbiAgICAgIH0sXHJcbiAgICAgIGJ1aWxkU3RhcnQoKSB7IHNvdXJjZUZpbmdlcnByaW50ID0gcnVudGltZUJ1aWxkRmluZ2VycHJpbnQoXCJ3ZWJcIiwgcmVwb3NpdG9yeVJvb3QpOyB9LFxyXG4gICAgICB3cml0ZUJ1bmRsZSgpIHtcclxuICAgICAgICBpZiAod3JpdGVzQWN0aXZlUnVudGltZSkge1xyXG4gICAgICAgICAgcmVjb3JkUnVudGltZUJ1aWxkKFwid2ViXCIsIHJlcG9zaXRvcnlSb290LCBzb3VyY2VGaW5nZXJwcmludCk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh3ZWJPdXRwdXREaXJlY3RvcnkgPT09IHJlc29sdmUocmVwb3NpdG9yeVJvb3QsIFwiZGlzdC8udG1wL2Rlc2t0b3AtZWxlY3Ryb24vd2ViLWNhbmRpZGF0ZVwiKSkge1xyXG4gICAgICAgICAgcmVjb3JkUnVudGltZUJ1aWxkKFwid2ViXCIsIHJlcG9zaXRvcnlSb290LCBzb3VyY2VGaW5nZXJwcmludCwgd2ViT3V0cHV0RGlyZWN0b3J5KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1dLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczogW1xyXG4gICAgICAgIC4uLndvcmtzcGFjZUFsaWFzZXMocmVwb3NpdG9yeVJvb3QpLFxyXG4gICAgICAgIHsgZmluZDogL15ub2RlOm1vZHVsZSQvdSwgcmVwbGFjZW1lbnQ6IHJlc29sdmUocmVwb3NpdG9yeVJvb3QsIFwiYXBwcy93ZWIvc3JjL25vZGUtbW9kdWxlLXN0dWIudHNcIikgfVxyXG4gICAgICBdXHJcbiAgICB9LFxyXG4gICAgZGVmaW5lOiB7XHJcbiAgICAgIF9fTEZBQV9QUk9KRUNUX0JVSUxEX0lORk9fXzogSlNPTi5zdHJpbmdpZnkocHJvamVjdEJ1aWxkTWV0YWRhdGEpLFxyXG4gICAgICAvLyBNYXRjaCBEU0gncyBicm93c2VyIGJ1aWxkOiBDb3JkaXMgTG9hZGVyJ3MgTm9kZS1vbmx5IGludGVybmFsIGxvYWRlclxyXG4gICAgICAvLyBzdGF5cyB1bnJlYWNoYWJsZSB3aGlsZSBpdHMgY2xpZW50LXNpZGUgaW50ZXJuYWwgc2xvdCBpcyBzdXBwbGllZFxyXG4gICAgICAvLyBieSB0aGUgRFNIIG1vZHVsZSBncmFwaCBhdCBib290LlxyXG4gICAgICBcInByb2Nlc3MudmVyc2lvbnMubm9kZVwiOiAnXCIwLjAuMFwiJyxcclxuICAgICAgXCJwcm9jZXNzLmV4ZWNBcmd2XCI6IFwiW11cIixcclxuICAgICAgXCJwcm9jZXNzLmVudi5DT1JESVNfU0hBUkVEXCI6IFwidW5kZWZpbmVkXCJcclxuICAgIH0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICB0YXJnZXQ6IFwiZXMyMDIyXCIsXHJcbiAgICAgIG91dERpcjogXCIuLi8uLi9kaXN0L2FwcHMvd2ViXCIsXHJcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xyXG4gICAgICAgICAgICBjb25zdCBtb2R1bGVJZCA9IGlkLnJlcGxhY2UoL1xcXFwvZ3UsIFwiL1wiKTtcclxuICAgICAgICAgICAgaWYgKG1vZHVsZUlkLmluY2x1ZGVzKFwiL3NpbXBsZS1pY29ucy9cIikpIHJldHVybiBcInZlbmRvci1zaW1wbGUtaWNvbnNcIjtcclxuICAgICAgICAgICAgaWYgKG1vZHVsZUlkLmluY2x1ZGVzKFwiL2thdGV4L1wiKSkgcmV0dXJuIFwidmVuZG9yLWthdGV4XCI7XHJcbiAgICAgICAgICAgIGlmIChtb2R1bGVJZC5pbmNsdWRlcyhcIi9yZWFjdC1kb20vXCIpKSByZXR1cm4gXCJ2ZW5kb3ItcmVhY3QtZG9tXCI7XHJcbiAgICAgICAgICAgIGlmIChtb2R1bGVJZC5pbmNsdWRlcyhcIi9Ac2hpa2lqcy9sYW5ncy9kaXN0L2NwcC1tYWNyby5tanNcIikpIHJldHVybiBcInZlbmRvci1zeW50YXgtY3BwLW1hY3JvXCI7XHJcbiAgICAgICAgICAgIGlmIChtb2R1bGVJZC5pbmNsdWRlcyhcIi9Ac2hpa2lqcy9sYW5ncy9kaXN0L3JlZ2V4cC5tanNcIikpIHJldHVybiBcInZlbmRvci1zeW50YXgtcmVnZXhwXCI7XHJcbiAgICAgICAgICAgIGlmIChbXCIvZGlzdC90eXBlc2NyaXB0Lm1qc1wiLCBcIi9kaXN0L3NoZWxsc2NyaXB0Lm1qc1wiLCBcIi9kaXN0L2pzb24ubWpzXCJdLnNvbWUoZmlsZU5hbWUgPT4gbW9kdWxlSWQuaW5jbHVkZXMoYC9Ac2hpa2lqcy9sYW5ncyR7ZmlsZU5hbWV9YCkpKSByZXR1cm4gXCJ2ZW5kb3Itc3ludGF4LWJhc2ljc1wiO1xyXG4gICAgICAgICAgICBpZiAobW9kdWxlSWQuaW5jbHVkZXMoXCIvc2hpa2kvXCIpIHx8IG1vZHVsZUlkLmluY2x1ZGVzKFwiL0BzaGlraWpzL1wiKSAmJiAhbW9kdWxlSWQuaW5jbHVkZXMoXCIvQHNoaWtpanMvbGFuZ3MvXCIpKSByZXR1cm4gXCJ2ZW5kb3Itc3ludGF4LWNvcmVcIjtcclxuICAgICAgICAgICAgaWYgKFtcIi9taWNyb21hcmsvXCIsIFwiL21pY3JvbWFyay1cIiwgXCIvbWRhc3QtdXRpbC1cIiwgXCIvaGFzdC11dGlsLVwiLCBcIi91bmlzdC11dGlsLVwiLCBcIi9wcm9wZXJ0eS1pbmZvcm1hdGlvbi9cIl0uc29tZShwYWNrYWdlUGF0aCA9PiBtb2R1bGVJZC5pbmNsdWRlcyhwYWNrYWdlUGF0aCkpKSByZXR1cm4gXCJ2ZW5kb3ItbWFya2Rvd25cIjtcclxuICAgICAgICAgICAgaWYgKG1vZHVsZUlkLmluY2x1ZGVzKFwiL0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXByaW1pdGl2ZXMvXCIpKSByZXR1cm4gXCJkc2gtdWktcHJpbWl0aXZlc1wiO1xyXG4gICAgICAgICAgICBpZiAobW9kdWxlSWQuaW5jbHVkZXMoXCIvQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktZG9ja2tpdC9cIikpIHJldHVybiBcImRzaC11aS1kb2Nra2l0XCI7XHJcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICAvLyBcdTZCNjNcdTVGMEZcdTc2RUVcdTVGNTVcdTc1MzFcdThENDRcdTZFOTBcdTRGRERcdTc1NTlcdTYzRDJcdTRFRjZcdTYzMDlcdTY3ODRcdTVFRkFcdTRFRTNcdTY1NzBcdTZFMDVcdTc0MDZcdUZGMUJcdTY2M0VcdTVGMEZcdTRFMzRcdTY1RjZcdThGOTNcdTUxRkFcdTRFQ0RcdTc1MzEgVml0ZSBcdTcyRUNcdTdBQ0JcdTZFMDVcdTdBN0FcdTMwMDJcclxuICAgICAgZW1wdHlPdXREaXI6IHByb2Nlc3MuYXJndi5zb21lKChhcmd1bWVudCkgPT4gYXJndW1lbnQgPT09IFwiLS1vdXREaXJcIiB8fCBhcmd1bWVudC5zdGFydHNXaXRoKFwiLS1vdXREaXI9XCIpKVxyXG4gICAgfSxcclxuICAgIHNlcnZlcjoge1xyXG4gICAgICBob3N0OiBcIjEyNy4wLjAuMVwiLFxyXG4gICAgICBwb3J0OiA1MTczLFxyXG4gICAgICBzdHJpY3RQb3J0OiB0cnVlLFxyXG4gICAgICBwcm94eTogY3JlYXRlSGFybmVzc0RldlByb3h5KHNlcnZlclRhcmdldCwgbWFya0JhY2tlbmRBdmFpbGFibGUpXHJcbiAgICB9XHJcbiAgfTtcclxufSk7XHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRTpcXFxcbGZhYTFcXFxcbGZhYVxcXFxhcHBzXFxcXHdlYlxcXFxzcmNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkU6XFxcXGxmYWExXFxcXGxmYWFcXFxcYXBwc1xcXFx3ZWJcXFxcc3JjXFxcXGRldi1wcm94eS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRTovbGZhYTEvbGZhYS9hcHBzL3dlYi9zcmMvZGV2LXByb3h5LnRzXCI7LyoqIFx1NTI5Rlx1ODBGRFx1RkYxQVx1NUI5QVx1NEU0OSBXZWIgXHU1RjAwXHU1M0QxXHU1MTY1XHU1M0UzXHU1MjMwIExGQUEgQ29udHJvbCBQbGFuZSBcdTc2ODRcdTU0MENcdTZFOTBcdThCRjdcdTZDNDJcdTRFRTNcdTc0MDZcdTMwMDJcdTRGNUNcdTc1MjhcdUZGMUFcdThCQTkgRFNIIFJ1bnRpbWUgXHU0RTBFXHU2M0QyXHU0RUY2IEhvc3QgQVBJIFx1NTkwRFx1NzUyOFx1NTUyRlx1NEUwMFx1NjcwRFx1NTJBMVx1N0FFRlx1MzAwMlx1NTE3M1x1ODA1NFx1NjU4N1x1NEVGNlx1RkYxQXZpdGUuY29uZmlnLnRzXHUzMDAxcGFja2FnZXMvaG9zdC93ZWJzZXJ2ZXJcdTMwMDIgKi9cclxuXHJcbmludGVyZmFjZSBQcm94eVNlcnZlckV2ZW50cyB7XHJcbiAgb24oZXZlbnQ6IHN0cmluZywgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB1bmtub3duO1xyXG59XHJcblxyXG50eXBlIFByb3h5Q29uZmlndXJlID0gKHByb3h5OiBQcm94eVNlcnZlckV2ZW50cykgPT4gdm9pZDtcclxuXHJcbi8qKiBLZWVwIHVwc3RyZWFtIERTSCBhbmQgcGx1Z2luIHJvdXRlcyBvbiB0aGUgYXV0aGVudGljYXRlZCBDb250cm9sIFBsYW5lIHdpdGhvdXQgcmV3cml0aW5nIHRoZWlyIHBhdGhzLiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSGFybmVzc0RldlByb3h5KHRhcmdldDogc3RyaW5nLCBjb25maWd1cmU6IFByb3h5Q29uZmlndXJlKSB7XHJcbiAgY29uc3Qgcm91dGUgPSAoKSA9PiAoeyB0YXJnZXQsIGNvbmZpZ3VyZSB9KTtcclxuICByZXR1cm4ge1xyXG4gICAgXCIvX19kc2hcIjogcm91dGUoKSxcclxuICAgIFwiL3BsdWdpbnNcIjogcm91dGUoKSxcclxuICAgIFwiL3dhbGxwYXBlci1lbmdpbmVcIjogcm91dGUoKSxcclxuICAgIFwiL2FwaVwiOiByb3V0ZSgpLFxyXG4gICAgXCIvc29ja2V0LmlvXCI6IHsgLi4ucm91dGUoKSwgd3M6IHRydWUgfVxyXG4gIH07XHJcbn1cclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxsZmFhMVxcXFxsZmFhXFxcXHNjcmlwdHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkU6XFxcXGxmYWExXFxcXGxmYWFcXFxcc2NyaXB0c1xcXFxoYXJuZXNzLXdvcmtzcGFjZS5tanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L2xmYWExL2xmYWEvc2NyaXB0cy9oYXJuZXNzLXdvcmtzcGFjZS5tanNcIjsvKiogXHU1MjlGXHU4MEZEXHVGRjFBXHU4QkZCXHU1M0Q2XHU1REU1XHU0RjVDXHU1MzNBXHU1MzA1XHU2RTA1XHU1MzU1XHUzMDAyXHU0RjVDXHU3NTI4XHVGRjFBXHU3RURGXHU0RTAwXHU2RDRGXHU4OUM4XHU1NjY4XHUzMDAxTm9kZSBcdTU0OENcdTY3ODRcdTVFRkFcdTc2ODRcdTUzMDVcdTY2MjBcdTVDMDRcdTMwMDJcdTUxNzNcdTgwNTRcdTY1ODdcdTRFRjZcdUZGMUFWaXRlIFx1OTE0RFx1N0Y2RVx1MzAwMXBhY2thZ2UtbG9hZGVyLm1qc1x1MzAwMWJ1aWxkLWhhcm5lc3MubWpzXHUzMDAyICovXHJcbmltcG9ydCB7IHJlYWRkaXJTeW5jLCByZWFkRmlsZVN5bmMsIGV4aXN0c1N5bmMgfSBmcm9tIFwibm9kZTpmc1wiO1xyXG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xyXG5leHBvcnQgZnVuY3Rpb24gd29ya3NwYWNlUGFja2FnZXMocm9vdCkge1xyXG4gIHJldHVybiByZWFkZGlyU3luYyhyZXNvbHZlKHJvb3QsIFwicGFja2FnZXNcIikpLmZsYXRNYXAoKGdyb3VwKSA9PlxyXG4gICAgcmVhZGRpclN5bmMocmVzb2x2ZShyb290LCBcInBhY2thZ2VzXCIsIGdyb3VwKSkuZmxhdE1hcCgoZW50cnkpID0+IHtcclxuICAgICAgY29uc3QgcGF0aCA9IGBwYWNrYWdlcy8ke2dyb3VwfS8ke2VudHJ5fWA7XHJcbiAgICAgIGNvbnN0IG1hbmlmZXN0ID0gcmVzb2x2ZShyb290LCBwYXRoLCBcInBhY2thZ2UuanNvblwiKTtcclxuICAgICAgcmV0dXJuIGV4aXN0c1N5bmMobWFuaWZlc3QpID8gW3sgcGF0aCwgLi4uSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMobWFuaWZlc3QsIFwidXRmOFwiKSkgfV0gOiBbXTtcclxuICAgIH0pKTtcclxufVxyXG4vKiogXHU4RkQ0XHU1NkRFXHU1M0VGXHU4RkRCXHU1MTY1XHU0RUE3XHU1NEMxXHU4RkQwXHU4ODRDXHU2ODExXHU3Njg0XHU1MzA1XHVGRjFCXHU1REU1XHU3QTBCXHU2NzFGXHU0RTBFXHU2RDRCXHU4QkQ1XHU2NTJGXHU2MzAxXHU1MzA1XHU0RUM1XHU1M0MyXHU0RTBFXHU1RjAwXHU1M0QxL1x1Njc4NFx1NUVGQVx1MzAwMiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcHJvZHVjdFJ1bnRpbWVQYWNrYWdlcyhyb290KSB7XHJcbiAgcmV0dXJuIHdvcmtzcGFjZVBhY2thZ2VzKHJvb3QpLmZpbHRlcigocGtnKSA9PlxyXG4gICAgcGtnLmxmYWE/LnJ1bnRpbWUgIT09IGZhbHNlICYmICFwa2cucGF0aC5zdGFydHNXaXRoKFwicGFja2FnZXMvY2xpZW50L1wiKSAmJiAhcGtnLnBhdGguc3RhcnRzV2l0aChcInBhY2thZ2VzL3Rlc3Qtc3VwcG9ydC9cIikpO1xyXG59XHJcbmV4cG9ydCBmdW5jdGlvbiB3b3Jrc3BhY2VBbGlhc2VzKHJvb3QpIHtcclxuICByZXR1cm4gd29ya3NwYWNlUGFja2FnZXMocm9vdCkuZmxhdE1hcCgocGtnKSA9PiB7XHJcbiAgICBjb25zdCBlbnRyeSA9IHdvcmtzcGFjZVNvdXJjZUVudHJ5KHJvb3QsIHBrZyk7XHJcbiAgICByZXR1cm4gW1xyXG4gICAgICB7IGZpbmQ6IGAke3BrZy5uYW1lfS9zcmNgLCByZXBsYWNlbWVudDogcmVzb2x2ZShyb290LCBwa2cucGF0aCwgXCJzcmNcIikgfSxcclxuICAgICAgLi4uKGVudHJ5ID8gW3sgZmluZDogcGtnLm5hbWUsIHJlcGxhY2VtZW50OiByZXNvbHZlKHJvb3QsIHBrZy5wYXRoLCBlbnRyeSkgfV0gOiBbXSlcclxuICAgIF07XHJcbiAgfSk7XHJcbn1cclxuXHJcbi8qKiBcdTUxNkNcdTVGMDBcdTUxNjVcdTUzRTNcdTRGMThcdTUxNDhcdThCRkJcdTUzRDYgbWFuaWZlc3RcdUZGMUJUU1gvTUpTIFx1NTE2NVx1NTNFM1x1NEUwRFx1ODBGRFx1ODhBQlx1NTZGQVx1NUI5QVx1NzY4NCBpbmRleC50cyBcdTg5ODZcdTc2RDZcdTMwMDIgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHdvcmtzcGFjZVNvdXJjZUVudHJ5KHJvb3QsIHBrZykge1xyXG4gIGNvbnN0IGRlY2xhcmVkID0gcGtnLmV4cG9ydHM/LltcIi5cIl07XHJcbiAgY29uc3QgZW50cnkgPSB0eXBlb2YgZGVjbGFyZWQgPT09IFwic3RyaW5nXCIgPyBkZWNsYXJlZCA6IGRlY2xhcmVkPy5pbXBvcnQgPz8gZGVjbGFyZWQ/LmRlZmF1bHQ7XHJcbiAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIGVudHJ5LnJlcGxhY2UoL15cXC5cXC8vdSwgXCJcIik7XHJcbiAgcmV0dXJuIFtcInNyYy9pbmRleC50c1wiLCBcInNyYy9pbmRleC50c3hcIiwgXCJzcmMvaW5kZXgubWpzXCJdLmZpbmQocGF0aCA9PiBleGlzdHNTeW5jKHJlc29sdmUocm9vdCwgcGtnLnBhdGgsIHBhdGgpKSk7XHJcbn1cclxuXHJcbi8qKiBUeXBlU2NyaXB0XHUzMDAxVml0ZSBcdTU0OEMgTm9kZSBcdTRFQ0VcdTU0MENcdTRFMDAgd29ya3NwYWNlIFx1NkUwNVx1NTM1NVx1NTNENlx1NUY5N1x1NTMwNVx1NEY0RFx1N0Y2RVx1MzAwMiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gd29ya3NwYWNlVHlwZVNjcmlwdFBhdGhzKHJvb3QpIHtcclxuICByZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKHdvcmtzcGFjZVBhY2thZ2VzKHJvb3QpLmZsYXRNYXAocGtnID0+IHtcclxuICAgIGNvbnN0IGVudHJ5ID0gd29ya3NwYWNlU291cmNlRW50cnkocm9vdCwgcGtnKTtcclxuICAgIHJldHVybiBbXHJcbiAgICAgIFtgJHtwa2cubmFtZX0vc3JjLypgLCBbYCR7cGtnLnBhdGh9L3NyYy8qYF1dLFxyXG4gICAgICAuLi4oZW50cnkgPyBbW3BrZy5uYW1lLCBbYCR7cGtnLnBhdGh9LyR7ZW50cnl9YF1dXSA6IFtdKVxyXG4gICAgXTtcclxuICB9KS5zb3J0KChbbGVmdF0sIFtyaWdodF0pID0+IGxlZnQubG9jYWxlQ29tcGFyZShyaWdodCwgXCJlblwiKSkpO1xyXG59XHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRTpcXFxcbGZhYTFcXFxcbGZhYVxcXFxzY3JpcHRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJFOlxcXFxsZmFhMVxcXFxsZmFhXFxcXHNjcmlwdHNcXFxccnVudGltZS1idWlsZC1zdGF0ZS5tanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L2xmYWExL2xmYWEvc2NyaXB0cy9ydW50aW1lLWJ1aWxkLXN0YXRlLm1qc1wiOy8qKlxyXG4gKiBcdTUyOUZcdTgwRkRcdUZGMUFcdThCQjBcdTVGNTVcdTVFNzZcdTY4QzBcdTY3RTVcdTZCNjNcdTVGMEZcdThGRDBcdTg4NENcdTY4MTFcdTVCRjlcdTVFOTRcdTc2ODRcdTZFOTBcdTc4MDFcdTYzMDdcdTdFQjlcdTMwMDJcclxuICogXHU0RjVDXHU3NTI4XHVGRjFBXHU4M0RDXHU1MzU1XHU1NDJGXHU1MkE4XHU1MjREXHU1M0QxXHU3M0IwXHU4RkM3XHU2NzFGXHU3Njg0IFdlYi9cdTYzQTdcdTUyMzZcdTdBRUZcdTY3ODRcdTVFRkFcdUZGMENcdTkwN0ZcdTUxNERcdTZFOTBcdTc4MDFcdTRGRUVcdTU5MERcdTU0MEVcdTRFQ0RcdThGRDBcdTg4NENcdTY1RTdcdThGOTNcdTUxRkFcdUZGMUJcdTRFMERcdThCRkJcdTUzRDZcdThGRDBcdTg4NENcdTY1NzBcdTYzNkVcdTYyMTZcdTc5RDhcdTVCQzZcdTkxNERcdTdGNkVcdTMwMDJcclxuICogXHU1MTczXHU4MDU0XHU2NTg3XHU0RUY2XHVGRjFBYnVpbGQtaGFybmVzcy5tanNcdTMwMDFhcHBzL3dlYi92aXRlLmNvbmZpZy50c1x1MzAwMWluc3RhbGwtZGVwZW5kZW5jaWVzLnBzMVx1MzAwMlxyXG4gKi9cclxuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gXCJub2RlOmNyeXB0b1wiO1xyXG5pbXBvcnQgeyBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMsIHJlYWRkaXJTeW5jLCBsc3RhdFN5bmMsIG1rZGlyU3luYywgd3JpdGVGaWxlU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XHJcbmltcG9ydCB7IGRpcm5hbWUsIHJlc29sdmUsIHJlbGF0aXZlLCBzZXAgfSBmcm9tIFwibm9kZTpwYXRoXCI7XHJcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tIFwibm9kZTp1cmxcIjtcclxuXHJcbmNvbnN0IHJvb3QgPSByZXNvbHZlKGRpcm5hbWUoZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKSwgXCIuLlwiKTtcclxuY29uc3QgZXhjbHVkZWQgPSBuZXcgU2V0KFtcIm5vZGVfbW9kdWxlc1wiLCBcImRhdGFcIiwgXCJkaXN0XCIsIFwidGFyZ2V0XCIsIFwiZ2VuXCIsIFwiLmdpdFwiXSk7XHJcbmNvbnN0IG91dHB1dHMgPSB7IGhvc3Q6IFwiZGlzdC9hcHBzL2NvbnRyb2wtcGxhbmVcIiwgd2ViOiBcImRpc3QvYXBwcy93ZWJcIiB9O1xyXG5jb25zdCByZXF1aXJlZE91dHB1dHMgPSB7XHJcbiAgaG9zdDogW1wiaW5kZXguanNcIiwgXCJ3b3Jrc3BhY2UuanNvblwiLCBcInBhY2thZ2VzL2Jvb3QvYXBwLWJvb3Qvc3JjL2luZGV4LmpzXCJdLFxyXG4gIHdlYjogW1wiaW5kZXguaHRtbFwiXVxyXG59O1xyXG5cclxuZnVuY3Rpb24gaW5wdXRzKHJlcG9zaXRvcnksIGtpbmQpIHtcclxuICBjb25zdCBmaWxlcyA9IFtdO1xyXG4gIGZ1bmN0aW9uIHdhbGsocGF0aCkge1xyXG4gICAgaWYgKCFleGlzdHNTeW5jKHBhdGgpKSByZXR1cm47XHJcbiAgICBjb25zdCBpbmZvID0gbHN0YXRTeW5jKHBhdGgpO1xyXG4gICAgaWYgKGluZm8uaXNTeW1ib2xpY0xpbmsoKSkgcmV0dXJuO1xyXG4gICAgaWYgKCFpbmZvLmlzRGlyZWN0b3J5KCkpIHsgZmlsZXMucHVzaChwYXRoKTsgcmV0dXJuOyB9XHJcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHJlYWRkaXJTeW5jKHBhdGgpLnNvcnQoKSkge1xyXG4gICAgICBpZiAoZXhjbHVkZWQuaGFzKGVudHJ5KSkgY29udGludWU7XHJcbiAgICAgIGlmIChyZWxhdGl2ZShyZXBvc2l0b3J5LCBwYXRoKS5yZXBsYWNlQWxsKFwiXFxcXFwiLCBcIi9cIikgPT09IFwiYXBwcy93ZWJcIiAmJiAvXnZpdGVcXC5jb25maWdcXC50c1xcLnRpbWVzdGFtcC1cXGQrLVthLWYwLTldK1xcLm1qcyQvdS50ZXN0KGVudHJ5KSkgY29udGludWU7XHJcbiAgICAgIHdhbGsocmVzb2x2ZShwYXRoLCBlbnRyeSkpO1xyXG4gICAgfVxyXG4gIH1cclxuICBmb3IgKGNvbnN0IHBhdGggb2YgW1wicGFja2FnZS5qc29uXCIsIFwicG5wbS1sb2NrLnlhbWxcIiwgYHRzY29uZmlnLiR7a2luZCA9PT0gXCJob3N0XCIgPyBcImhvc3RcIiA6IFwiY2xpZW50XCJ9Lmpzb25gLCBcInNjcmlwdHMvaGFybmVzcy13b3Jrc3BhY2UubWpzXCIsIFwic2NyaXB0cy9ydW50aW1lLWJ1aWxkLXN0YXRlLm1qc1wiXSkgd2FsayhyZXNvbHZlKHJlcG9zaXRvcnksIHBhdGgpKTtcclxuICB3YWxrKHJlc29sdmUocmVwb3NpdG9yeSwga2luZCA9PT0gXCJob3N0XCIgPyBcInNjcmlwdHMvYnVpbGQtaGFybmVzcy5tanNcIiA6IFwiYXBwcy93ZWJcIikpO1xyXG4gIGlmIChraW5kID09PSBcImhvc3RcIikgeyB3YWxrKHJlc29sdmUocmVwb3NpdG9yeSwgXCJhcHBzL2NsaS9zcmNcIikpOyB3YWxrKHJlc29sdmUocmVwb3NpdG9yeSwgXCJhcHBzL2NsaS9jb25maWdcIikpOyB9XHJcbiAgZm9yIChjb25zdCBncm91cCBvZiByZWFkZGlyU3luYyhyZXNvbHZlKHJlcG9zaXRvcnksIFwicGFja2FnZXNcIikpKSB7XHJcbiAgICBpZiAoZ3JvdXAgPT09IFwidGVzdC1zdXBwb3J0XCIgfHwga2luZCA9PT0gXCJob3N0XCIgJiYgZ3JvdXAgPT09IFwiY2xpZW50XCIpIGNvbnRpbnVlO1xyXG4gICAgZm9yIChjb25zdCBuYW1lIG9mIHJlYWRkaXJTeW5jKHJlc29sdmUocmVwb3NpdG9yeSwgXCJwYWNrYWdlc1wiLCBncm91cCkpKSB7XHJcbiAgICAgIGNvbnN0IHBhdGggPSByZXNvbHZlKHJlcG9zaXRvcnksIFwicGFja2FnZXNcIiwgZ3JvdXAsIG5hbWUpO1xyXG4gICAgICBpZiAoZXhpc3RzU3luYyhyZXNvbHZlKHBhdGgsIFwicGFja2FnZS5qc29uXCIpKSkgd2FsayhwYXRoKTtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIGZpbGVzLnNvcnQoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJ1bnRpbWVCdWlsZEZpbmdlcnByaW50KGtpbmQsIHJlcG9zaXRvcnkgPSByb290KSB7XHJcbiAgaWYgKCFvdXRwdXRzW2tpbmRdKSB0aHJvdyBuZXcgRXJyb3IoXCJcdTY3MkFcdTc3RTVcdTY3ODRcdTVFRkFcdTgwNENcdThEMjNcdTMwMDJcIik7XHJcbiAgY29uc3QgaGFzaCA9IGNyZWF0ZUhhc2goXCJzaGEyNTZcIik7XHJcbiAgZm9yIChjb25zdCBmaWxlIG9mIGlucHV0cyhyZXBvc2l0b3J5LCBraW5kKSkge1xyXG4gICAgaGFzaC51cGRhdGUocmVsYXRpdmUocmVwb3NpdG9yeSwgZmlsZSkucmVwbGFjZUFsbChcIlxcXFxcIiwgXCIvXCIpKTsgaGFzaC51cGRhdGUoXCJcXDBcIik7XHJcbiAgICBoYXNoLnVwZGF0ZShyZWFkRmlsZVN5bmMoZmlsZSkpOyBoYXNoLnVwZGF0ZShcIlxcMFwiKTtcclxuICB9XHJcbiAgcmV0dXJuIGhhc2guZGlnZXN0KFwiaGV4XCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVjb3JkUnVudGltZUJ1aWxkKGtpbmQsIHJlcG9zaXRvcnkgPSByb290LCBleHBlY3RlZEZpbmdlcnByaW50LCBvdXRwdXREaXJlY3RvcnkpIHtcclxuICBjb25zdCBmaW5nZXJwcmludCA9IHJ1bnRpbWVCdWlsZEZpbmdlcnByaW50KGtpbmQsIHJlcG9zaXRvcnkpO1xyXG4gIGlmIChleHBlY3RlZEZpbmdlcnByaW50ICE9PSB1bmRlZmluZWQgJiYgZmluZ2VycHJpbnQgIT09IGV4cGVjdGVkRmluZ2VycHJpbnQpIHRocm93IG5ldyBFcnJvcihcIlx1Njc4NFx1NUVGQVx1NjcxRlx1OTVGNFx1NkU5MFx1NzgwMVx1NTNEMVx1NzUxRlx1NTNEOFx1NTMxNlx1RkYwQ1x1OEJGN1x1OTFDRFx1NjVCMFx1Njc4NFx1NUVGQVx1RkYwQ1x1OTA3Rlx1NTE0RFx1OEJCMFx1NUY1NVx1OEZDN1x1NjcxRlx1OEY5M1x1NTFGQVx1MzAwMlwiKTtcclxuICBjb25zdCBvdXRwdXQgPSBvdXRwdXREaXJlY3RvcnkgPT09IHVuZGVmaW5lZCA/IHJlc29sdmUocmVwb3NpdG9yeSwgb3V0cHV0c1traW5kXSkgOiByZXNvbHZlKHJlcG9zaXRvcnksIG91dHB1dERpcmVjdG9yeSk7XHJcbiAgY29uc3QgZGlzdFJvb3QgPSByZXNvbHZlKHJlcG9zaXRvcnksIFwiZGlzdFwiKTtcclxuICBjb25zdCByZWxhdGl2ZU91dHB1dCA9IHJlbGF0aXZlKGRpc3RSb290LCBvdXRwdXQpO1xyXG4gIGlmICghcmVsYXRpdmVPdXRwdXQgfHwgcmVsYXRpdmVPdXRwdXQgPT09IFwiLi5cIiB8fCByZWxhdGl2ZU91dHB1dC5zdGFydHNXaXRoKGAuLiR7c2VwfWApKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFx1Njc4NFx1NUVGQVx1NjMwN1x1N0VCOVx1NTNFQVx1NTE0MVx1OEJCOFx1NTE5OVx1NTE2NVx1NEVEM1x1NUU5M1x1NjgzOSBkaXN0LyBcdTRFMEJcdTc2ODRcdThGOTNcdTUxRkFcdTc2RUVcdTVGNTVcdUZGMUEke291dHB1dH1gKTtcclxuICB9XHJcbiAgbWtkaXJTeW5jKG91dHB1dCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XHJcbiAgd3JpdGVGaWxlU3luYyhyZXNvbHZlKG91dHB1dCwgXCJidWlsZC1zdGF0ZS5qc29uXCIpLCBKU09OLnN0cmluZ2lmeSh7IGtpbmQsIGZpbmdlcnByaW50IH0pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHN0YWxlUnVudGltZUJ1aWxkcyhwcm9maWxlID0gXCJ3ZWJcIiwgcmVwb3NpdG9yeSA9IHJvb3QpIHtcclxuICByZXR1cm4gKHByb2ZpbGUgPT09IFwid2ViXCIgPyBbXCJob3N0XCIsIFwid2ViXCJdIDogW1wiaG9zdFwiXSkuZmlsdGVyKGtpbmQgPT4ge1xyXG4gICAgY29uc3Qgb3V0cHV0ID0gcmVzb2x2ZShyZXBvc2l0b3J5LCBvdXRwdXRzW2tpbmRdKTtcclxuICAgIGlmIChyZXF1aXJlZE91dHB1dHNba2luZF0uc29tZShwYXRoID0+ICFleGlzdHNTeW5jKHJlc29sdmUob3V0cHV0LCBwYXRoKSkpKSByZXR1cm4gdHJ1ZTtcclxuICAgIGlmIChraW5kID09PSBcIndlYlwiKSB7XHJcbiAgICAgIGNvbnN0IGh0bWwgPSByZWFkRmlsZVN5bmMocmVzb2x2ZShvdXRwdXQsIFwiaW5kZXguaHRtbFwiKSwgXCJ1dGY4XCIpO1xyXG4gICAgICBjb25zdCBhc3NldHMgPSBbLi4uaHRtbC5tYXRjaEFsbCgvKD86c3JjfGhyZWYpPVtcIiddKFteXCInXSspW1wiJ10vZ3UpXVxyXG4gICAgICAgIC5tYXAoKFssIHBhdGhdKSA9PiBwYXRoKVxyXG4gICAgICAgIC5maWx0ZXIocGF0aCA9PiBwYXRoLnN0YXJ0c1dpdGgoXCIvYXNzZXRzL1wiKSk7XHJcbiAgICAgIGlmICghYXNzZXRzLmxlbmd0aCB8fCBhc3NldHMuc29tZShwYXRoID0+ICFleGlzdHNTeW5jKHJlc29sdmUob3V0cHV0LCBgLiR7cGF0aH1gKSkpKSByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIHRyeSB7IHJldHVybiBKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhyZXNvbHZlKG91dHB1dCwgXCJidWlsZC1zdGF0ZS5qc29uXCIpLCBcInV0ZjhcIikpLmZpbmdlcnByaW50ICE9PSBydW50aW1lQnVpbGRGaW5nZXJwcmludChraW5kLCByZXBvc2l0b3J5KTsgfVxyXG4gICAgY2F0Y2ggeyByZXR1cm4gdHJ1ZTsgfVxyXG4gIH0pO1xyXG59XHJcblxyXG5pZiAocHJvY2Vzcy5hcmd2WzFdICYmIHJlc29sdmUocHJvY2Vzcy5hcmd2WzFdKSA9PT0gZmlsZVVSTFRvUGF0aChpbXBvcnQubWV0YS51cmwpKSB7XHJcbiAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoYCR7SlNPTi5zdHJpbmdpZnkoc3RhbGVSdW50aW1lQnVpbGRzKHByb2Nlc3MuYXJndlsyXSkpfVxcbmApO1xyXG59XHJcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRTpcXFxcbGZhYTFcXFxcbGZhYVxcXFxhcHBzXFxcXHdlYlxcXFxzY3JpcHRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJFOlxcXFxsZmFhMVxcXFxsZmFhXFxcXGFwcHNcXFxcd2ViXFxcXHNjcmlwdHNcXFxcd2ViLWFzc2V0LXJldGVudGlvbi5tanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L2xmYWExL2xmYWEvYXBwcy93ZWIvc2NyaXB0cy93ZWItYXNzZXQtcmV0ZW50aW9uLm1qc1wiOy8qKlxyXG4gKiBcdTUyOUZcdTgwRkRcdUZGMUFcdTRGRERcdTc1NTkgV2ViIFx1NjcwMFx1OEZEMVx1NTFFMFx1NEVFM1x1NTE4NVx1NUJCOVx1NTRDOFx1NUUwQ1x1OEQ0NFx1NkU5MFx1MzAwMlxyXG4gKiBcdTRGNUNcdTc1MjhcdUZGMUFcdTk4NzVcdTk3NjJcdTUzNDdcdTdFQTdcdTU0MEVcdUZGMENcdTVERjJcdTYyNTNcdTVGMDBcdTc2ODRcdTY1RTdcdTY4MDdcdTdCN0VcdTRFQ0RcdTgwRkRcdTUyQTBcdThGN0RcdTUxNzZcdTYxRDJcdTUyQTBcdThGN0RcdTZBMjFcdTU3NTdcdUZGMUJcdTUzODZcdTUzRjJcdThENDRcdTZFOTBcdTY1NzBcdTkxQ0ZcdTU2RkFcdTVCOUFcdTY3MDlcdTc1NENcdTMwMDJcclxuICogXHU1MTczXHU4MDU0XHU2NTg3XHU0RUY2XHVGRjFBYXBwcy93ZWIvdml0ZS5jb25maWcudHNcdTMwMDFhcHBzL2NsaS90ZXN0cy93ZWItYXNzZXQtcmV0ZW50aW9uLnRlc3QubWpzXHUzMDAyXHJcbiAqL1xyXG5pbXBvcnQgeyByZWFkZGlyLCByZWFkRmlsZSwgcmVuYW1lLCB1bmxpbmssIHdyaXRlRmlsZSB9IGZyb20gXCJub2RlOmZzL3Byb21pc2VzXCI7XHJcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tIFwibm9kZTpwYXRoXCI7XHJcblxyXG5jb25zdCBISVNUT1JZX0ZJTEVOQU1FID0gXCIubGZhYS13ZWItYXNzZXQtaGlzdG9yeS5qc29uXCI7XHJcbmNvbnN0IE1BWF9SRVRBSU5FRF9HRU5FUkFUSU9OUyA9IDM7XHJcbmNvbnN0IFZFUlNJT05FRF9BU1NFVF9QQVRIID0gL15hc3NldHNcXC9bXi9dKy1bQS1aYS16MC05Xy1dezgsfVxcLig/OmpzfGNzc3x3b2ZmMj98dHRmfG90Znxwbmd8anBlP2d8c3ZnfHdlYnB8YXZpZnxnaWZ8d2FzbXxtYXApJC9pdTtcclxuXHJcbmZ1bmN0aW9uIG5vcm1hbGl6ZUFzc2V0UGF0aHMocGF0aHMpIHtcclxuICBpZiAoIUFycmF5LmlzQXJyYXkocGF0aHMpKSByZXR1cm4gW107XHJcbiAgcmV0dXJuIFsuLi5uZXcgU2V0KHBhdGhzXHJcbiAgICAuZmlsdGVyKChwYXRoKSA9PiB0eXBlb2YgcGF0aCA9PT0gXCJzdHJpbmdcIilcclxuICAgIC5tYXAoKHBhdGgpID0+IHBhdGgucmVwbGFjZUFsbChcIlxcXFxcIiwgXCIvXCIpKVxyXG4gICAgLmZpbHRlcigocGF0aCkgPT4gVkVSU0lPTkVEX0FTU0VUX1BBVEgudGVzdChwYXRoKSkpXS5zb3J0KCk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGxpc3RFeGlzdGluZ1ZlcnNpb25lZEFzc2V0cyhvdXRwdXREaXJlY3RvcnkpIHtcclxuICBsZXQgZW50cmllcztcclxuICB0cnkge1xyXG4gICAgZW50cmllcyA9IGF3YWl0IHJlYWRkaXIocmVzb2x2ZShvdXRwdXREaXJlY3RvcnksIFwiYXNzZXRzXCIpLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XHJcbiAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgIGlmIChlcnJvciAmJiB0eXBlb2YgZXJyb3IgPT09IFwib2JqZWN0XCIgJiYgXCJjb2RlXCIgaW4gZXJyb3IgJiYgZXJyb3IuY29kZSA9PT0gXCJFTk9FTlRcIikgcmV0dXJuIFtdO1xyXG4gICAgdGhyb3cgZXJyb3I7XHJcbiAgfVxyXG4gIHJldHVybiBlbnRyaWVzXHJcbiAgICAuZmlsdGVyKChlbnRyeSkgPT4gZW50cnkuaXNGaWxlKCkgJiYgVkVSU0lPTkVEX0FTU0VUX1BBVEgudGVzdChgYXNzZXRzLyR7ZW50cnkubmFtZX1gKSlcclxuICAgIC5tYXAoKGVudHJ5KSA9PiBgYXNzZXRzLyR7ZW50cnkubmFtZX1gKVxyXG4gICAgLnNvcnQoKTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRXZWJBc3NldEhpc3Rvcnkob3V0cHV0RGlyZWN0b3J5KSB7XHJcbiAgY29uc3QgaGlzdG9yeVBhdGggPSByZXNvbHZlKG91dHB1dERpcmVjdG9yeSwgSElTVE9SWV9GSUxFTkFNRSk7XHJcbiAgbGV0IHNvdXJjZTtcclxuICB0cnkge1xyXG4gICAgc291cmNlID0gYXdhaXQgcmVhZEZpbGUoaGlzdG9yeVBhdGgsIFwidXRmOFwiKTtcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgaWYgKGVycm9yICYmIHR5cGVvZiBlcnJvciA9PT0gXCJvYmplY3RcIiAmJiBcImNvZGVcIiBpbiBlcnJvciAmJiBlcnJvci5jb2RlID09PSBcIkVOT0VOVFwiKSB7XHJcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgbGlzdEV4aXN0aW5nVmVyc2lvbmVkQXNzZXRzKG91dHB1dERpcmVjdG9yeSk7XHJcbiAgICAgIHJldHVybiBleGlzdGluZy5sZW5ndGggPyBbZXhpc3RpbmddIDogW107XHJcbiAgICB9XHJcbiAgICB0aHJvdyBlcnJvcjtcclxuICB9XHJcblxyXG4gIGxldCBwYXJzZWQ7XHJcbiAgdHJ5IHtcclxuICAgIHBhcnNlZCA9IEpTT04ucGFyc2Uoc291cmNlKTtcclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBXZWIgXHU4RDQ0XHU2RTkwXHU0RkREXHU3NTU5XHU4QkIwXHU1RjU1XHU2MzVGXHU1NzRGXHVGRjBDXHU0RTNBXHU5MDdGXHU1MTREXHU4QkVGXHU1MjIwXHU1REYyXHU2MjUzXHU1RjAwXHU5ODc1XHU5NzYyXHU4RDQ0XHU2RTkwXHU4MDBDXHU1MDVDXHU2QjYyXHU2Nzg0XHU1RUZBXHVGRjFBJHtoaXN0b3J5UGF0aH1gLCB7IGNhdXNlOiBlcnJvciB9KTtcclxuICB9XHJcbiAgaWYgKCFwYXJzZWQgfHwgcGFyc2VkLnNjaGVtYVZlcnNpb24gIT09IDEgfHwgIUFycmF5LmlzQXJyYXkocGFyc2VkLmdlbmVyYXRpb25zKSkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBXZWIgXHU4RDQ0XHU2RTkwXHU0RkREXHU3NTU5XHU4QkIwXHU1RjU1XHU2ODNDXHU1RjBGXHU0RTBEXHU1M0Q3XHU2NTJGXHU2MzAxXHVGRjBDXHU0RTNBXHU5MDdGXHU1MTREXHU4QkVGXHU1MjIwXHU2NUU3XHU5ODc1XHU5NzYyXHU4RDQ0XHU2RTkwXHU4MDBDXHU1MDVDXHU2QjYyXHU2Nzg0XHU1RUZBXHVGRjFBJHtoaXN0b3J5UGF0aH1gKTtcclxuICB9XHJcbiAgcmV0dXJuIHBhcnNlZC5nZW5lcmF0aW9uc1xyXG4gICAgLmZpbHRlcihBcnJheS5pc0FycmF5KVxyXG4gICAgLm1hcChub3JtYWxpemVBc3NldFBhdGhzKVxyXG4gICAgLmZpbHRlcigoZ2VuZXJhdGlvbikgPT4gZ2VuZXJhdGlvbi5sZW5ndGggPiAwKVxyXG4gICAgLnNsaWNlKDAsIE1BWF9SRVRBSU5FRF9HRU5FUkFUSU9OUyAtIDEpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmV0YWluV2ViQXNzZXRHZW5lcmF0aW9ucyhvdXRwdXREaXJlY3RvcnksIGN1cnJlbnRBc3NldFBhdGhzLCBwcmV2aW91c0dlbmVyYXRpb25zID0gW10pIHtcclxuICBjb25zdCBjdXJyZW50ID0gbm9ybWFsaXplQXNzZXRQYXRocyhjdXJyZW50QXNzZXRQYXRocyk7XHJcbiAgaWYgKGN1cnJlbnQubGVuZ3RoID09PSAwKSB0aHJvdyBuZXcgRXJyb3IoXCJXZWIgXHU2Nzg0XHU1RUZBXHU2Q0ExXHU2NzA5XHU3NTFGXHU2MjEwXHU1RTI2XHU1NEM4XHU1RTBDXHU4RDQ0XHU2RTkwXHVGRjBDXHU1REYyXHU1MDVDXHU2QjYyXHU1Mzg2XHU1M0YyXHU4RDQ0XHU2RTkwXHU2RTA1XHU3NDA2XHUzMDAyXCIpO1xyXG5cclxuICBjb25zdCBnZW5lcmF0aW9ucyA9IFtcclxuICAgIGN1cnJlbnQsXHJcbiAgICAuLi5wcmV2aW91c0dlbmVyYXRpb25zLmZpbHRlcihBcnJheS5pc0FycmF5KS5tYXAobm9ybWFsaXplQXNzZXRQYXRocykuZmlsdGVyKChnZW5lcmF0aW9uKSA9PiBnZW5lcmF0aW9uLmxlbmd0aCA+IDApXHJcbiAgXS5zbGljZSgwLCBNQVhfUkVUQUlORURfR0VORVJBVElPTlMpO1xyXG4gIGNvbnN0IHJldGFpbmVkID0gbmV3IFNldChnZW5lcmF0aW9ucy5mbGF0KCkpO1xyXG4gIGNvbnN0IGhpc3RvcnlQYXRoID0gcmVzb2x2ZShvdXRwdXREaXJlY3RvcnksIEhJU1RPUllfRklMRU5BTUUpO1xyXG4gIGNvbnN0IHRlbXBvcmFyeUhpc3RvcnlQYXRoID0gYCR7aGlzdG9yeVBhdGh9LnRtcGA7XHJcbiAgYXdhaXQgd3JpdGVGaWxlKHRlbXBvcmFyeUhpc3RvcnlQYXRoLCBgJHtKU09OLnN0cmluZ2lmeSh7IHNjaGVtYVZlcnNpb246IDEsIGdlbmVyYXRpb25zIH0sIG51bGwsIDIpfVxcbmAsIFwidXRmOFwiKTtcclxuICBhd2FpdCByZW5hbWUodGVtcG9yYXJ5SGlzdG9yeVBhdGgsIGhpc3RvcnlQYXRoKTtcclxuXHJcbiAgY29uc3QgZW50cmllcyA9IGF3YWl0IHJlYWRkaXIocmVzb2x2ZShvdXRwdXREaXJlY3RvcnksIFwiYXNzZXRzXCIpLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSk7XHJcbiAgY29uc3QgcmVtb3ZlZCA9IFtdO1xyXG4gIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xyXG4gICAgY29uc3QgYXNzZXRQYXRoID0gYGFzc2V0cy8ke2VudHJ5Lm5hbWV9YDtcclxuICAgIGlmICghZW50cnkuaXNGaWxlKCkgfHwgIVZFUlNJT05FRF9BU1NFVF9QQVRILnRlc3QoYXNzZXRQYXRoKSB8fCByZXRhaW5lZC5oYXMoYXNzZXRQYXRoKSkgY29udGludWU7XHJcbiAgICBhd2FpdCB1bmxpbmsocmVzb2x2ZShvdXRwdXREaXJlY3RvcnksIGFzc2V0UGF0aCkpO1xyXG4gICAgcmVtb3ZlZC5wdXNoKGFzc2V0UGF0aCk7XHJcbiAgfVxyXG4gIHJldHVybiB7IGdlbmVyYXRpb25zLCByZW1vdmVkIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVXZWJBc3NldFJldGVudGlvblBsdWdpbihyZXBvc2l0b3J5Um9vdCkge1xyXG4gIGxldCBvdXRwdXREaXJlY3RvcnkgPSBcIlwiO1xyXG4gIGxldCBpc0FjdGl2ZVdlYk91dHB1dCA9IGZhbHNlO1xyXG4gIGxldCBwcmV2aW91c0dlbmVyYXRpb25zID0gW107XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBuYW1lOiBcImxmYWEtd2ViLWFzc2V0LXJldGVudGlvblwiLFxyXG4gICAgYXBwbHk6IFwiYnVpbGRcIixcclxuICAgIGNvbmZpZ1Jlc29sdmVkKGNvbmZpZykge1xyXG4gICAgICBvdXRwdXREaXJlY3RvcnkgPSBjb25maWcuYnVpbGQub3V0RGlyO1xyXG4gICAgICBpc0FjdGl2ZVdlYk91dHB1dCA9IHJlc29sdmUoY29uZmlnLnJvb3QsIG91dHB1dERpcmVjdG9yeSkgPT09IHJlc29sdmUocmVwb3NpdG9yeVJvb3QsIFwiZGlzdFwiLCBcImFwcHNcIiwgXCJ3ZWJcIik7XHJcbiAgICB9LFxyXG4gICAgYXN5bmMgYnVpbGRTdGFydCgpIHtcclxuICAgICAgcHJldmlvdXNHZW5lcmF0aW9ucyA9IGlzQWN0aXZlV2ViT3V0cHV0ID8gYXdhaXQgcmVhZFdlYkFzc2V0SGlzdG9yeShvdXRwdXREaXJlY3RvcnkpIDogW107XHJcbiAgICB9LFxyXG4gICAgYXN5bmMgd3JpdGVCdW5kbGUoX29wdGlvbnMsIGJ1bmRsZSkge1xyXG4gICAgICBpZiAoIWlzQWN0aXZlV2ViT3V0cHV0KSByZXR1cm47XHJcbiAgICAgIGNvbnN0IGN1cnJlbnRBc3NldHMgPSBPYmplY3Qua2V5cyhidW5kbGUpO1xyXG4gICAgICBjb25zdCB7IGdlbmVyYXRpb25zLCByZW1vdmVkIH0gPSBhd2FpdCByZXRhaW5XZWJBc3NldEdlbmVyYXRpb25zKG91dHB1dERpcmVjdG9yeSwgY3VycmVudEFzc2V0cywgcHJldmlvdXNHZW5lcmF0aW9ucyk7XHJcbiAgICAgIHRoaXMuaW5mbyhgV2ViIFx1NTRDOFx1NUUwQ1x1OEQ0NFx1NkU5MFx1NEZERFx1NzU1OSAke2dlbmVyYXRpb25zLmxlbmd0aH0gXHU0RUUzXHVGRjBDXHU2RTA1XHU3NDA2ICR7cmVtb3ZlZC5sZW5ndGh9IFx1NEUyQVx1OEZDN1x1NjcxRlx1OEQ0NFx1NkU5MFx1MzAwMmApO1xyXG4gICAgfVxyXG4gIH07XHJcbn1cclxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxsZmFhMVxcXFxsZmFhXFxcXGFwcHNcXFxcd2ViXFxcXHNjcmlwdHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkU6XFxcXGxmYWExXFxcXGxmYWFcXFxcYXBwc1xcXFx3ZWJcXFxcc2NyaXB0c1xcXFxwcm9qZWN0LXZlcnNpb24ubWpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9FOi9sZmFhMS9sZmFhL2FwcHMvd2ViL3NjcmlwdHMvcHJvamVjdC12ZXJzaW9uLm1qc1wiO2NvbnN0IFNUQUJMRV9WRVJTSU9OX1BBVFRFUk4gPSAvXigwfFsxLTldXFxkKilcXC4oMHxbMS05XVxcZCopXFwuKDB8WzEtOV1cXGQqKSQvdTtcclxuY29uc3QgUkVMRUFTRV9GRUVEX1NVRkZJWCA9IFwiL3JlbGVhc2VzL2xhdGVzdC9kb3dubG9hZFwiO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVByb2plY3RCdWlsZE1ldGFkYXRhKHsgcHJvamVjdFBhY2thZ2UsIHdlYlBhY2thZ2UsIGVsZWN0cm9uUGFja2FnZSwgcmVsZWFzZU1hbmlmZXN0IH0pIHtcclxuICBjb25zdCBjdXJyZW50VmVyc2lvbiA9IHJlYWRTdGFibGVWZXJzaW9uKHByb2plY3RQYWNrYWdlPy52ZXJzaW9uLCBcImFwcHMvY2xpL3BhY2thZ2UuanNvblwiKTtcclxuICBmb3IgKGNvbnN0IFttYW5pZmVzdCwgbGFiZWxdIG9mIFtcclxuICAgIFt3ZWJQYWNrYWdlLCBcImFwcHMvd2ViL3BhY2thZ2UuanNvblwiXSxcclxuICAgIFtlbGVjdHJvblBhY2thZ2UsIFwiYXBwcy9kZXNrdG9wLWVsZWN0cm9uL3BhY2thZ2UuanNvblwiXVxyXG4gIF0pIHtcclxuICAgIGlmIChyZWFkU3RhYmxlVmVyc2lvbihtYW5pZmVzdD8udmVyc2lvbiwgbGFiZWwpICE9PSBjdXJyZW50VmVyc2lvbikge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFx1OTg3OVx1NzZFRVx1NzI0OFx1NjcyQ1x1NEUwRFx1NEUwMFx1ODFGNFx1RkYxQSR7bGFiZWx9IFx1NUZDNVx1OTg3Qlx1NEUwRSBhcHBzL2NsaS9wYWNrYWdlLmpzb24gXHU1NDBDXHU0RTNBICR7Y3VycmVudFZlcnNpb259XHUzMDAyYCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBjb25zdCByZXBvc2l0b3J5VXJsID0gcHJvamVjdFBhY2thZ2U/LnJlcG9zaXRvcnk/LnVybDtcclxuICBpZiAodHlwZW9mIHJlcG9zaXRvcnlVcmwgIT09IFwic3RyaW5nXCIpIHRocm93IG5ldyBFcnJvcihcImFwcHMvY2xpL3BhY2thZ2UuanNvbiBcdTdGM0FcdTVDMTEgTEZBQSBcdTRFRDNcdTVFOTNcdTU3MzBcdTU3NDBcdTMwMDJcIik7XHJcbiAgbGV0IHBhcnNlZFJlcG9zaXRvcnlVcmw7XHJcbiAgdHJ5IHtcclxuICAgIHBhcnNlZFJlcG9zaXRvcnlVcmwgPSBuZXcgVVJMKHJlcG9zaXRvcnlVcmwuc3RhcnRzV2l0aChcImdpdCtcIikgPyByZXBvc2l0b3J5VXJsLnNsaWNlKDQpIDogcmVwb3NpdG9yeVVybCk7XHJcbiAgfSBjYXRjaCB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJhcHBzL2NsaS9wYWNrYWdlLmpzb24gXHU0RTJEXHU3Njg0IExGQUEgXHU0RUQzXHU1RTkzXHU1NzMwXHU1NzQwXHU2NUUwXHU2NTQ4XHUzMDAyXCIpO1xyXG4gIH1cclxuICBjb25zdCByZXBvc2l0b3J5UGFydHMgPSBwYXJzZWRSZXBvc2l0b3J5VXJsLnBhdGhuYW1lLnNwbGl0KFwiL1wiKS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgaWYgKHBhcnNlZFJlcG9zaXRvcnlVcmwucHJvdG9jb2wgIT09IFwiaHR0cHM6XCIgfHwgcGFyc2VkUmVwb3NpdG9yeVVybC5ob3N0bmFtZSAhPT0gXCJnaXRodWIuY29tXCJcclxuICAgIHx8IHBhcnNlZFJlcG9zaXRvcnlVcmwudXNlcm5hbWUgfHwgcGFyc2VkUmVwb3NpdG9yeVVybC5wYXNzd29yZCB8fCBwYXJzZWRSZXBvc2l0b3J5VXJsLnNlYXJjaCB8fCBwYXJzZWRSZXBvc2l0b3J5VXJsLmhhc2hcclxuICAgIHx8IHJlcG9zaXRvcnlQYXJ0cy5sZW5ndGggIT09IDIgfHwgIS9eW0EtWmEtejAtOV8uLV0rJC91LnRlc3QocmVwb3NpdG9yeVBhcnRzWzBdKVxyXG4gICAgfHwgIS9eW0EtWmEtejAtOV8uLV0rKD86XFwuZ2l0KT8kL3UudGVzdChyZXBvc2l0b3J5UGFydHNbMV0pKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJMRkFBIFx1NEVEM1x1NUU5M1x1NTczMFx1NTc0MFx1NUZDNVx1OTg3Qlx1NjYyRiBHaXRIdWIgXHU0RTBBXHU3Njg0IEhUVFBTIG93bmVyL3JlcG9zaXRvcnkgXHU1NzMwXHU1NzQwXHUzMDAyXCIpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgW293bmVyLCByZXBvc2l0b3J5V2l0aFN1ZmZpeF0gPSByZXBvc2l0b3J5UGFydHM7XHJcbiAgY29uc3QgcmVwb3NpdG9yeSA9IHJlcG9zaXRvcnlXaXRoU3VmZml4LnJlcGxhY2UoL1xcLmdpdCQvdSwgXCJcIik7XHJcbiAgaWYgKCFyZXBvc2l0b3J5KSB0aHJvdyBuZXcgRXJyb3IoXCJMRkFBIFx1NEVEM1x1NUU5M1x1NTQwRFx1NzlGMFx1N0YzQVx1NTkzMVx1MzAwMlwiKTtcclxuICBjb25zdCByZWxlYXNlUGFnZSA9IGBodHRwczovL2dpdGh1Yi5jb20vJHtvd25lcn0vJHtyZXBvc2l0b3J5fS9yZWxlYXNlc2A7XHJcbiAgY29uc3QgZmVlZFVybCA9IGBodHRwczovL2dpdGh1Yi5jb20vJHtvd25lcn0vJHtyZXBvc2l0b3J5fSR7UkVMRUFTRV9GRUVEX1NVRkZJWH0vYDtcclxuICBjb25zdCBhbm5vdW5jZW1lbnQgPSByZWFkUmVsZWFzZUFubm91bmNlbWVudChyZWxlYXNlTWFuaWZlc3QsIGN1cnJlbnRWZXJzaW9uKTtcclxuXHJcbiAgcmV0dXJuIE9iamVjdC5mcmVlemUoe1xyXG4gICAgY3VycmVudFZlcnNpb24sXHJcbiAgICBwdWJsaXNoZWRBdDogYW5ub3VuY2VtZW50LnB1Ymxpc2hlZEF0LFxyXG4gICAgcmVsZWFzZU5vdGVzOiBhbm5vdW5jZW1lbnQucmVsZWFzZU5vdGVzLFxyXG4gICAgdXBkYXRlTWFuaWZlc3RVcmw6IGBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vJHtvd25lcn0vJHtyZXBvc2l0b3J5fS9tYWluL3VwZGF0ZS5qc29uYCxcclxuICAgIGZlZWRVcmwsXHJcbiAgICByZWxlYXNlUGFnZVxyXG4gIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkUmVsZWFzZUFubm91bmNlbWVudChtYW5pZmVzdCwgY3VycmVudFZlcnNpb24pIHtcclxuICBpZiAoIW1hbmlmZXN0IHx8IHR5cGVvZiBtYW5pZmVzdCAhPT0gXCJvYmplY3RcIiB8fCBBcnJheS5pc0FycmF5KG1hbmlmZXN0KVxyXG4gICAgfHwgbWFuaWZlc3QudmVyc2lvbiAhPT0gY3VycmVudFZlcnNpb24gfHwgbWFuaWZlc3QudGl0bGUgIT09IGBMRkFBICR7Y3VycmVudFZlcnNpb259YCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKFwidXBkYXRlLmpzb24gXHU1RkM1XHU5ODdCXHU2M0QwXHU0RjlCXHU0RTBFXHU1RjUzXHU1MjREXHU0RUE3XHU1NEMxXHU3MjQ4XHU2NzJDXHU0RTAwXHU4MUY0XHU3Njg0XHU1MTZDXHU1NDRBXHU1MTg1XHU1QkI5XHUzMDAyXCIpO1xyXG4gIH1cclxuICBjb25zdCBwdWJsaXNoZWRBdCA9IG1hbmlmZXN0LnB1Ymxpc2hlZEF0O1xyXG4gIGlmICh0eXBlb2YgcHVibGlzaGVkQXQgIT09IFwic3RyaW5nXCIgfHwgIS9eXFxkezR9LVxcZHsyfS1cXGR7Mn0kL3UudGVzdChwdWJsaXNoZWRBdClcclxuICAgIHx8IE51bWJlci5pc05hTihEYXRlLnBhcnNlKGAke3B1Ymxpc2hlZEF0fVQwMDowMDowMFpgKSlcclxuICAgIHx8IG5ldyBEYXRlKGAke3B1Ymxpc2hlZEF0fVQwMDowMDowMFpgKS50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKSAhPT0gcHVibGlzaGVkQXQpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcihcInVwZGF0ZS5qc29uIFx1NTE2Q1x1NTQ0QVx1NTNEMVx1NUUwM1x1NjVFNVx1NjcxRlx1NjVFMFx1NjU0OFx1MzAwMlwiKTtcclxuICB9XHJcbiAgY29uc3QgcmVsZWFzZU5vdGVzID0gbWFuaWZlc3QucmVsZWFzZU5vdGVzO1xyXG4gIGlmICghQXJyYXkuaXNBcnJheShyZWxlYXNlTm90ZXMpIHx8IHJlbGVhc2VOb3Rlcy5sZW5ndGggPCAxIHx8IHJlbGVhc2VOb3Rlcy5sZW5ndGggPiAzMlxyXG4gICAgfHwgcmVsZWFzZU5vdGVzLnNvbWUobm90ZSA9PiB0eXBlb2Ygbm90ZSAhPT0gXCJzdHJpbmdcIiB8fCAhbm90ZS50cmltKCkpXHJcbiAgICB8fCByZWxlYXNlTm90ZXMucmVkdWNlKCh0b3RhbCwgbm90ZSkgPT4gdG90YWwgKyBub3RlLmxlbmd0aCwgMCkgPiAxMl8wMDApIHtcclxuICAgIHRocm93IG5ldyBFcnJvcihcInVwZGF0ZS5qc29uIFx1NTE2Q1x1NTQ0QVx1NTE4NVx1NUJCOVx1NUZDNVx1OTg3Qlx1NjYyRiAxIFx1ODFGMyAzMiBcdTY3NjFcdTk3NUVcdTdBN0FcdTY1ODdcdTY3MkNcdUZGMENcdTU0MDhcdThCQTFcdTRFMERcdThEODVcdThGQzcgMTIwMDAgXHU1QjU3XHU3QjI2XHUzMDAyXCIpO1xyXG4gIH1cclxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZSh7IHB1Ymxpc2hlZEF0LCByZWxlYXNlTm90ZXM6IE9iamVjdC5mcmVlemUocmVsZWFzZU5vdGVzLm1hcChub3RlID0+IG5vdGUudHJpbSgpKSkgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRTdGFibGVWZXJzaW9uKHZhbHVlLCBsYWJlbCkge1xyXG4gIGlmICh0eXBlb2YgdmFsdWUgIT09IFwic3RyaW5nXCIgfHwgIVNUQUJMRV9WRVJTSU9OX1BBVFRFUk4udGVzdCh2YWx1ZSlcclxuICAgIHx8IHZhbHVlLnNwbGl0KFwiLlwiKS5zb21lKChwYXJ0KSA9PiAhTnVtYmVyLmlzU2FmZUludGVnZXIoTnVtYmVyKHBhcnQpKSkpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcihgJHtsYWJlbH0gXHU1RkM1XHU5ODdCXHU1OEYwXHU2NjBFXHU3QTMzXHU1QjlBXHU3MjQ4IHgueS56IFx1OTg3OVx1NzZFRVx1NzI0OFx1NjcyQ1x1MzAwMmApO1xyXG4gIH1cclxuICByZXR1cm4gdmFsdWU7XHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUtBLFNBQVMsV0FBQUEsVUFBUyxXQUFBQyxnQkFBZTtBQUNqQyxTQUFTLGlCQUFBQyxzQkFBcUI7QUFDOUIsU0FBUyxnQkFBQUMscUJBQW9CO0FBQzdCLFNBQVMsY0FBYyxjQUFjLGVBQTRCO0FBQ2pFLE9BQU8sV0FBVztBQUNsQixTQUFTLDZCQUE2Qjs7O0FDRC9CLFNBQVMsc0JBQXNCLFFBQWdCLFdBQTJCO0FBQy9FLFFBQU0sUUFBUSxPQUFPLEVBQUUsUUFBUSxVQUFVO0FBQ3pDLFNBQU87QUFBQSxJQUNMLFVBQVUsTUFBTTtBQUFBLElBQ2hCLFlBQVksTUFBTTtB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Uyx5Q0FBeUM7QUFBRyxxQkFBTztBQUN6RSxnQkFBSSxTQUFTLFNBQVMsc0NBQXNDO0FBQUcscUJBQU87QUFDdEUsbUJBQU87QUFBQSxVQUNUO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQTtBQUFBLE1BRUEsYUFBYSxRQUFRLEtBQUssS0FBSyxDQUFDLGFBQWEsYUFBYSxjQUFjLFNBQVMsV0FBVyxXQUFXLENBQUM7QUFBQSxJQUMxRztBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sWUFBWTtBQUFBLE1BQ1osT0FBTyxzQkFBc0IsY0FBYyxvQkFBb0I7QUFBQSxJQUNqRTtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJkaXJuYW1lIiwgInJlc29sdmUiLCAiZmlsZVVSTFRvUGF0aCIsICJyZWFkRmlsZVN5bmMiLCAicm9vdCIsICJyb290IiwgImV4aXN0c1N5bmMiLCAicmVhZEZpbGVTeW5jIiwgInJlYWRkaXJTeW5jIiwgInJlc29sdmUiLCAicmVzb2x2ZSIsICJleGlzdHNTeW5jIiwgInJlYWRkaXJTeW5jIiwgInJlYWRGaWxlU3luYyIsICJyZXNvbHZlIiwgInJlc29sdmUiLCAicmVwb3NpdG9yeVJvb3QiLCAiX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCIsICJyZXNvbHZlIiwgImRpcm5hbWUiLCAiZmlsZVVSTFRvUGF0aCIsICJyZWFkRmlsZVN5bmMiXQp9Cg==

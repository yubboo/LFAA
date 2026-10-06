/** 功能：验收 Electron 已封装的桌面运行树。作用：用随包 Node/Loader 实际加载桌面 Profile 的 CUA 插件，但不启动服务或执行桌面操作。关联文件：apps/desktop-electron/package.json、apps/cli/package-loader.mjs、apps/desktop-electron/scripts/prepare-runtime.mjs。 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const runtimeRoot = resolve(repositoryRoot, "dist/apps/desktop-electron/win-unpacked/resources/app-runtime");
const driverManifestPath = resolve(runtimeRoot, "apps/cli/node_modules/@trycua/cua-driver/package.json");
const sourceManifestPath = resolve(repositoryRoot, "packages/computer-use/computer-use/package.json");
const driverManifest = JSON.parse(await readFile(driverManifestPath, "utf8"));
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));
const expectedVersion = sourceManifest.dependencies?.["@trycua/cua-driver"];

if (driverManifest.name !== "@trycua/cua-driver" || driverManifest.version !== expectedVersion) {
  throw new Error(`Electron 运行树中的 CUA Driver 与源码声明不一致：${driverManifestPath}；期望 ${expectedVersion}，实际 ${driverManifest.version ?? "未知版本"}。`);
}

const nodePath = resolve(runtimeRoot, "node.exe");
const loaderPath = resolve(runtimeRoot, "apps/cli/register-package-loader.mjs");
const pluginPath = resolve(runtimeRoot, "dist/apps/control-plane/packages/computer-use/computer-use/src/index.js");
await Promise.all([stat(nodePath), stat(loaderPath), stat(pluginPath)]);

const smokeCode = [
  `import { apply } from ${JSON.stringify(pathToFileURL(pluginPath).href)};`,
  'const ctx = { profileContext: { name: "desktop" }, lfaaTools: { registerTool() {} }, effect() {} };',
  "await apply(ctx);",
  'console.log("桌面 Profile CUA Driver 导入与工具注册通过。");'
].join("\n");

const smokeEnvironment = Object.fromEntries(["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP"]
  .filter(key => process.env[key])
  .map(key => [key, process.env[key]]));
Object.assign(smokeEnvironment, {
  CUA_DRIVER_RS_TELEMETRY_ENABLED: "false",
  JWT_SECRET: randomBytes(32).toString("hex"),
  LFAA_DATA_DIR: resolve(repositoryRoot, "dist/.tmp/desktop-electron/runtime-smoke-data"),
  LFAA_DESKTOP_MODE: "true",
  NODE_ENV: "production"
});

const child = spawn(nodePath, ["--import", pathToFileURL(loaderPath).href, "--input-type=module", "-e", smokeCode], {
  cwd: resolve(runtimeRoot, "apps/cli"),
  env: smokeEnvironment,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"]
});

let stdout = "";
let stderr = "";
child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });

await new Promise((resolvePromise, rejectPromise) => {
  const timeout = setTimeout(() => {
    child.kill();
    rejectPromise(new Error("Electron 随包桌面 Profile 导入检查超过 60 秒。"));
  }, 60_000);
  child.once("error", error => {
    clearTimeout(timeout);
    rejectPromise(error);
  });
  child.once("exit", code => {
    clearTimeout(timeout);
    if (code === 0) resolvePromise();
    else rejectPromise(new Error(`Electron 随包桌面 Profile 导入失败（退出码 ${code}）。\n${stdout}${stderr}`));
  });
});

process.stdout.write(stdout || "Electron 随包桌面 Profile CUA Driver 导入检查通过。\n");

#!/usr/bin/env node
/**
 * 功能：提供源码工作区和 npm 包共用的 lfaa 命令。
 * 作用：选择编译后的运行树、加载用户环境与包解析器，并启动指定 Harness 组合。
 * 关联文件：apps/cli/package.json、register-package-loader.mjs、app-boot、scripts/package-cli.mjs。
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
const packaged = existsSync(resolve(packageRoot, "dist/apps/control-plane/workspace.json"));
const runtimeRoot = packaged ? packageRoot : resolve(packageRoot, "../..");

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`LFAA ${manifest.version}\n用法：lfaa web [--home <目录>] [--patch <文件>] [--no-local-daemon]\n      lfaa daemon\n      lfaa daemon export --node <ID> --output-file <文件>\n      lfaa daemon configure --connection-file <文件>\n源码启动：pnpm lfaa web\nnpm 启动：npx @yubboo/lfaa web\n`);
    return;
  }
  if (args.includes("--version") || args.includes("-v")) { process.stdout.write(`${manifest.version}\n`); return; }
  const minimum = manifest.engines.node.replace(/^>=/u, "").split(".").map(Number);
  const current = process.versions.node.split(".").map(Number);
  const difference = current.map((value, index) => value - minimum[index]).find((value) => value !== 0) ?? 0;
  if (difference < 0) throw new Error(`LFAA 需要 Node.js ${manifest.engines.node}；当前为 ${process.versions.node}。`);

  const profile = args[0] === "--profile" ? args[1] : args[0];
  if (!profile || !/^[a-z][a-z0-9-]*$/u.test(profile)) throw new Error("运行组合名称无效；使用 lfaa --help 查看用法。");
  const entry = resolve(runtimeRoot, "dist/apps/control-plane/packages/boot/app-boot/src/index.js");
  if (!existsSync(entry)) throw new Error("找不到编译后的 LFAA；请先运行 pnpm install 和 pnpm run build。");
  if (profile === "web" && !existsSync(resolve(runtimeRoot, "dist/apps/web/index.html"))) throw new Error("Web 界面尚未构建；请先运行 pnpm run build:web。");

  const environmentFile = resolve(packaged ? process.cwd() : runtimeRoot, ".env");
  if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);
  process.env.NODE_ENV ??= "production";
  if (packaged) {
    // npm 缓存会随版本更换；运行数据使用用户目录或调用目录下显式配置的路径。
    process.env.LFAA_DATA_DIR = process.env.LFAA_DATA_DIR?.trim()
      ? resolve(process.cwd(), process.env.LFAA_DATA_DIR.trim())
      : resolve(homedir(), ".lfaa", "data");
  }
  if (profile === "web") {
    process.env.LFAA_SERVE_FRONTEND = "true";
    process.env.LFAA_LOCAL_MODE ??= "true";
  }
  if (profile === "daemon" && args[1] === "export") {
    const id = args[args.indexOf("--node") + 1], destination = args[args.indexOf("--output-file") + 1];
    if (!args.includes("--node") || !args.includes("--output-file") || !id || !destination) throw new Error("请指定 --node 和 --output-file；导出文件不能覆盖已有文件。");
    await import(pathToFileURL(resolve(runtimeRoot, "apps/cli/register-package-loader.mjs")).href);
    const { exportDaemonConnection } = await import(pathToFileURL(resolve(runtimeRoot, "dist/apps/control-plane/packages/host/daemon/src/node-credentials.js")).href);
    exportDaemonConnection(id, resolve(destination));
    process.stdout.write("节点连接文件已导出；导入目标节点后删除传输副本。\n");
    return;
  }
  if (profile === "daemon" && args[1] === "configure") {
    const file = args[args.indexOf("--connection-file") + 1];
    if (!args.includes("--connection-file") || !file) throw new Error("请指定 --connection-file；不要把通信密钥写在命令参数中。");
    const { configureDaemonConnection } = await import(pathToFileURL(resolve(runtimeRoot, "dist/apps/control-plane/packages/host/daemon/src/connection-config.mjs")).href);
    const { resolveDataDirectory } = await import(pathToFileURL(resolve(runtimeRoot, "dist/apps/control-plane/packages/util/home-paths/src/resolve-data-directory.mjs")).href);
    const node = await configureDaemonConnection(resolve(file), resolveDataDirectory(runtimeRoot, process.env.LFAA_DATA_DIR?.trim() || "data"));
    process.stdout.write(`节点连接已保存：${node.displayName}（${node.nodeId}）。运行 lfaa daemon 连接控制端。\n`);
    return;
  }
  await import(pathToFileURL(resolve(runtimeRoot, "apps/cli/register-package-loader.mjs")).href);
  // 在装配前给出实际部署配置错误，不把密钥配置失败埋进一串等待依赖的插件名称中。
  if (profile === "web") await import(pathToFileURL(resolve(runtimeRoot, "dist/apps/control-plane/packages/util/launch-environment/src/config.js")).href);
  const { boot } = await import(pathToFileURL(entry).href);
  const context = await boot(args);
  if (profile === "web") {
    if (process.platform === "win32" && process.arch === "x64" && !args.includes("--no-local-daemon")) {
      const { config } = await import(pathToFileURL(resolve(runtimeRoot, "dist/apps/control-plane/packages/util/launch-environment/src/config.js")).href);
      const connectionConfigured = existsSync(resolve(config.dataDirectory, "credentials/daemon-connection.json"));
      const { superviseLocalDaemon } = await import(pathToFileURL(resolve(runtimeRoot, "dist/apps/control-plane/packages/host/daemon/src/supervisor.mjs")).href);
      if (connectionConfigured) process.stderr.write("此数据目录已配置远程节点连接；未将它作为本机节点托管。控制端和远程执行器应使用各自的数据目录。\n");
      else {
        const homeIndex = args.indexOf("--home");
        const daemonArgs = [fileURLToPath(import.meta.url), "daemon", ...(homeIndex >= 0 ? ["--home", args[homeIndex + 1]] : [])];
        const supervisor = superviseLocalDaemon({ args: daemonArgs, cwd: process.cwd() });
        context.effect(() => () => supervisor.stop());
      }
    }
    const address = context.get("lfaaWebserver").server.address();
    const host = ["0.0.0.0", "::"].includes(address.address) ? "localhost" : address.address;
    process.stdout.write(`LFAA Web 已就绪：http://${host.includes(":") ? `[${host}]` : host}:${address.port}\n按 Ctrl+C 停止。\n`);
  }
}

try { await main(); }
catch (error) { process.stderr.write(`${error instanceof Error ? error.message : "LFAA 启动失败。"}\n`); process.exitCode = 1; }

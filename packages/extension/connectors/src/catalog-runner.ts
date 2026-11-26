// 目录连接任务：MCP 走「写配置 → 等连接」，CLI 走「缺命令就静默安装 → 写连接器」，进度写回任务对象。
import type { CatalogEntry, CatalogJob, CatalogMcpDefinition } from "../contract";
import { firstLine, probeExecutable, resolveExecutable, runProcess } from "./cli-exec";
import { findInstaller, installerArgs, installerLabel } from "./installer";

export interface CatalogDeps {
  listMcp(): Array<{ id: string; status: string; tools?: unknown[] }>;
  saveMcp(id: string, payload: Record<string, unknown>, create: boolean): Promise<void>;
  hasCli(id: string): boolean;
  saveCli(id: string, payload: Record<string, unknown>, create: boolean): Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

/** 把 `{{key}}` 占位符换成用户输入。 */
function fill(inputs: Record<string, string>, value: string): string {
  return value.replace(/\{\{([A-Za-z0-9_]+)\}\}/gu, (_match, key: string) => inputs[key]?.trim() ?? "");
}

/** 连接前校验必填输入项。 */
export function requireInputs(entry: CatalogEntry, inputs: Record<string, string>): void {
  for (const input of entry.inputs ?? []) {
    if (input.required !== false && !inputs[input.key]?.trim()) throw new Error(`请填写${input.label}。`);
  }
}

async function connectMcp(job: CatalogJob, entry: CatalogEntry, inputs: Record<string, string>, deps: CatalogDeps): Promise<void> {
  const definition = entry.mcp as CatalogMcpDefinition;
  const create = !deps.listMcp().some((server) => server.id === entry.id);
  job.message = `正在下载并连接 ${entry.name}…`;
  const env = definition.env
    ? Object.fromEntries(Object.entries(definition.env).map(([key, value]) => [key, fill(inputs, value)]))
    : undefined;
  await deps.saveMcp(entry.id, {
    transport: definition.transport,
    enabled: true,
    trust: "ask",
    ...(definition.command ? { command: fill(inputs, definition.command) } : {}),
    ...(definition.args ? { args: definition.args.map((arg) => fill(inputs, arg)) } : {}),
    ...(definition.url ? { url: fill(inputs, definition.url) } : {}),
    ...(env ? { env } : {}),
  }, create);
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const server = deps.listMcp().find((item) => item.id === entry.id);
    if (server?.status === "connected") {
      const count = server.tools?.length ?? 0;
      job.message = count > 0 ? `连接器 ${entry.name} 已连接，服务器返回 ${count} 个工具。` : `连接器 ${entry.name} 已连接，服务器未声明工具。`;
      return;
    }
    if (server?.status === "error") throw new Error(`连接失败：${entry.name} 未能启动，请检查命令与网络。`);
    await sleep(1_000);
  }
  throw new Error("连接超时，请稍后重试。");
}

async function connectCli(job: CatalogJob, entry: CatalogEntry, inputs: Record<string, string>, deps: CatalogDeps): Promise<void> {
  const definition = entry.cli;
  if (!definition) throw new Error("目录条目缺少 CLI 配置。");
  const executable = fill(inputs, definition.executable);
  if (!resolveExecutable(executable)) {
    const install = (definition.installs ?? [])
      .map((spec) => ({ spec, path: findInstaller(spec.manager) }))
      .find((item) => item.path);
    if (!install?.path) throw new Error(`未找到 ${executable}，且当前没有可用的安装器（winget / choco / scoop / npm）。`);
    job.message = `正在安装 ${installerLabel(install.spec)}…`;
    const result = await runProcess(install.path, installerArgs(install.spec), { timeoutMs: 20 * 60_000 });
    if (result.timedOut) throw new Error("安装超时，请稍后重试。");
    if (result.code !== 0) {
      throw new Error(`安装失败：${firstLine(result.stderr) || firstLine(result.stdout) || `退出码 ${result.code ?? "未知"}`}`);
    }
    if (!resolveExecutable(executable)) throw new Error(`${entry.name} 安装完成但未找到命令，请重开应用或检查 PATH。`);
  }
  job.message = `正在探测 ${entry.name}…`;
  // 真实执行一次命令；失败就不写入连接器，避免「配置存在但根本跑不起来」的假连接。
  const probe = await probeExecutable(executable, definition.probeArgs ?? ["--version"]);
  if (probe.error) throw new Error(`探测失败：${probe.error}`);
  await deps.saveCli(entry.id, {
    name: entry.name,
    description: entry.description,
    executable,
    cwd: "",
    env: {},
    trust: "ask",
    enabled: true,
    ...(definition.probeArgs ? { probeArgs: definition.probeArgs } : {}),
    actions: definition.actions,
  }, !deps.hasCli(entry.id));
  job.message = `连接器 ${entry.name} 已连接，命令探测成功${probe.version ? `：${probe.version}` : ""}。`;
}

/** 执行一次连接任务；成功/失败都写回任务状态，调用方只负责轮询。 */
export async function runCatalogConnect(
  job: CatalogJob,
  entry: CatalogEntry,
  inputs: Record<string, string>,
  deps: CatalogDeps,
): Promise<void> {
  requireInputs(entry, inputs);
  if (entry.kind === "mcp") await connectMcp(job, entry, inputs, deps);
  else await connectCli(job, entry, inputs, deps);
  job.state = "done";
}
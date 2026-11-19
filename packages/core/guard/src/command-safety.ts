// 命令安全基线：拦截引用应用私有文件的命令，并把命令执行写入本地审计日志。
import { appendFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** 一条命令审计记录；命令正文截断后保存，避免日志无限膨胀。 */
export interface CommandAuditEntry {
  at: number;
  sessionId: string;
  runId: string;
  cwd: string;
  command: string;
  ok: boolean;
  exitCode?: number;
  timedOut?: boolean;
}

const AUDIT_COMMAND_LIMIT = 2_000;
/** 单个审计文件默认上限 5 MB，超出后轮转并保留最近 3 份。 */
const DEFAULT_AUDIT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_AUDIT_KEEP_FILES = 3;

function readPositiveInt(name: string, fallback: number): number {
  const raw = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function auditFilePath(): string {
  const override = process.env.LFAA_COMMAND_AUDIT_LOG?.trim();
  return override || join(homedir(), ".lfaa", "logs", "commands.jsonl");
}

// 审计写入前按大小轮转，避免长期运行把单个日志文件撑到不可读。
async function rotateAuditFile(filePath: string): Promise<void> {
  const maxBytes = readPositiveInt("LFAA_COMMAND_AUDIT_MAX_BYTES", DEFAULT_AUDIT_MAX_BYTES);
  const keepFiles = readPositiveInt("LFAA_COMMAND_AUDIT_KEEP_FILES", DEFAULT_AUDIT_KEEP_FILES);
  try {
    const info = await stat(filePath);
    if (info.size < maxBytes) return;
    await rm(`${filePath}.${keepFiles}`, { force: true }).catch(() => undefined);
    for (let index = keepFiles - 1; index >= 1; index -= 1) {
      await rename(`${filePath}.${index}`, `${filePath}.${index + 1}`).catch(() => undefined);
    }
    await rename(filePath, `${filePath}.1`).catch(() => undefined);
  } catch {
    // 文件不存在或不可轮转时直接继续追加。
  }
}

/** 追加一条命令审计记录；审计写入失败不影响命令本身。 */
export async function appendCommandAudit(entry: CommandAuditEntry): Promise<void> {
  try {
    const filePath = auditFilePath();
    await mkdir(dirname(filePath), { recursive: true });
    await rotateAuditFile(filePath);
    await appendFile(
      filePath,
      `${JSON.stringify({ ...entry, command: entry.command.slice(0, AUDIT_COMMAND_LIMIT) })}\n`,
      "utf8",
    );
  } catch {
    // 审计不可用时静默跳过，不阻断命令执行。
  }
}

/** 识别命令是否显式引用应用私有文件；返回被保护项的名称用于提示。 */
export function findProtectedPathInCommand(command: string): string | undefined {
  const normalized = command.replace(/\u0000/gu, " ");
  if (/\.lfaa[\\/](?:credentials|sessions)(?:[\\/"'\s]|$)/iu.test(normalized)) {
    return "凭据或会话目录（.lfaa/credentials、.lfaa/sessions）";
  }
  if (/llm-config\.json/iu.test(normalized)) {
    return "模型配置文件（llm-config.json，含 API Key）";
  }
  if (/smart-approvals\.json/iu.test(normalized)) {
    return "审批信任记录（smart-approvals.json）";
  }
  return undefined;
}

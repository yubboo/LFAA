// Shell 环境的标准输出解码。接收原始字节，兼容 UTF-8 及 Windows 本地控制台。
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import iconv from "iconv-lite";

const execFileAsync = promisify(execFile);
const strictUtf8 = new TextDecoder("utf-8", { fatal: true });
let windowsCodePage: Promise<string | undefined> | undefined;

function supportedCodePage(number: string | undefined): string | undefined {
  const encoding = number === "65001" ? "utf8" : number ? `cp${number}` : undefined;
  return encoding && iconv.encodingExists(encoding) ? encoding : undefined;
}

/** chcp 的末尾代码页是 ASCII，可直接从原始响应中提取。 */
async function readWindowsCodePage(): Promise<string | undefined> {
  const system32 = join(process.env.SystemRoot ?? "C:\\Windows", "System32");
  try {
    const { stdout } = await execFileAsync(join(system32, "chcp.com"), [], { timeout: 1500, windowsHide: true, encoding: "buffer" });
    const number = stdout.toString("latin1").match(/\b(\d{3,5})\s*$/u)?.[1];
    const encoding = supportedCodePage(number);
    if (encoding && encoding !== "utf8") return encoding;
  } catch {
    // 没有活动控制台时，后台进程可从 Windows 的 OEM 配置读取默认代码页。
  }
  try {
    const { stdout } = await execFileAsync(join(system32, "reg.exe"),
      ["query", "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Nls\\CodePage", "/v", "OEMCP"],
      { timeout: 1500, windowsHide: true, encoding: "buffer" });
    const number = stdout.toString("latin1").match(/^\s*OEMCP\s+REG_SZ\s+(\d+)\s*$/mu)?.[1];
    return supportedCodePage(number);
  } catch {
    return undefined;
  }
}

/** 只在字节确实无效时查询原生编码，保持现代命令的 UTF-8 快路径。 */
async function decodeCommandOutput(bytes: Buffer | undefined, partial: boolean): Promise<string> {
  if (!bytes?.length) return "";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes, { stream: partial });
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes, { stream: partial });
  // WSL 等 Windows 工具会输出不带 BOM 的 UTF-16，连续 ASCII 文本的高字节为零。
  if (process.platform === "win32" && bytes.includes(0)) {
    const pairs = Math.min(Math.floor(bytes.length / 2), 512);
    let lowZeros = 0;
    let highZeros = 0;
    for (let i = 0; i < pairs; i += 1) {
      if (bytes[i * 2] === 0) lowZeros += 1;
      if (bytes[i * 2 + 1] === 0) highZeros += 1;
    }
    if (highZeros >= 2 && lowZeros === 0 && highZeros >= pairs / 3) {
      return new TextDecoder("utf-16le").decode(bytes, { stream: partial });
    }
    if (lowZeros >= 2 && highZeros === 0 && lowZeros >= pairs / 3) {
      return new TextDecoder("utf-16be").decode(bytes, { stream: partial });
    }
  }
  try {
    return partial ? new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true }) : strictUtf8.decode(bytes);
  } catch {
    if (process.platform === "win32") {
      windowsCodePage ??= readWindowsCodePage();
      const encoding = await windowsCodePage;
      if (encoding) return partial ? iconv.getDecoder(encoding).write(bytes) : iconv.decode(bytes, encoding);
    }
    return bytes.toString("utf8");
  }
}

/** 标准输出与错误输出独立解码，一条命令可以同时调用不同编码的程序。 */
export async function formatCommandOutput(stdout: Buffer | undefined, stderr: Buffer | undefined, partial = false): Promise<string> {
  const streams = await Promise.all([decodeCommandOutput(stdout, partial), decodeCommandOutput(stderr, partial)]);
  return streams.map((stream) => stream.trim()).filter(Boolean).join("\n--- stderr ---\n");
}

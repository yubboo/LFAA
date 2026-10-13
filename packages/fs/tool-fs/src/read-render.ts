/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-fs/src/read-render.ts。
 * 功能：读取结果渲染——把全文文本切成分页窗口、单行超长截断、按字节封顶，并格式化为带行号的模型信封。
 * 作用：read 工具统一用这里做行/字节封顶与渲染，避免无界输出灌进上下文。
 * 与 DSH 差异：DSH 从异步流增量切行；LFAA 本机后端已返回完整文本（受硬上限保护），这里对字符串做等价窗口。
 * 关联文件：read-target.ts、read.ts。
 */

/** 单行最大字符数（超出截断并提示）。 */
export const READ_MAX_LINE_LENGTH = 2000;
/** 单次选中行的最大输出字节数。 */
export const READ_MAX_BYTES = 50 * 1024;

/** 一条返回行。 */
export interface FileTextLine {
  readonly number: number;
  readonly text: string;
}

/** 窗口结果。 */
export interface WindowResult {
  readonly lines: FileTextLine[];
  readonly totalLines: number;
  readonly truncatedByBytes: boolean;
}

/** 窗口请求。 */
export interface ReadWindow {
  readonly offset: number;
  readonly limit: number;
  readonly maxLineLength: number;
  readonly maxBytes: number;
}

function stripCr(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

/** 从全文构建窗口：精确统计总行数，选中行按行/字节封顶，offset 越界报错。 */
export function buildWindow(text: string, request: ReadWindow, display: string): WindowResult {
  const allLines = text.split("\n");
  const totalLines = allLines.length;
  const lines: FileTextLine[] = [];
  let outputBytes = 0;
  let truncatedByBytes = false;

  for (let i = 0; i < totalLines; i += 1) {
    const lineNumber = i + 1;
    if (lineNumber < request.offset || lines.length >= request.limit) continue;
    const raw = stripCr(allLines[i]);
    const text2 = raw.length > request.maxLineLength
      ? `${raw.slice(0, request.maxLineLength)}... (行截断到 ${request.maxLineLength} 字符)`
      : raw;
    const bytes = Buffer.byteLength(text2, "utf8") + (lines.length > 0 ? 1 : 0);
    if (outputBytes + bytes > request.maxBytes) {
      truncatedByBytes = true;
      break;
    }
    outputBytes += bytes;
    lines.push({ number: lineNumber, text: text2 });
  }

  if (!truncatedByBytes && request.offset > totalLines && !(totalLines === 0 && request.offset === 1)) {
    throw new Error(`offset ${request.offset} 超出文件范围（${display} 共 ${totalLines} 行）。`);
  }
  return { lines, totalLines, truncatedByBytes };
}

/** 把窗口渲染为模型可见的带行号文本 + 续读脚注。 */
export function formatReadOutput(display: string, outcome: { offset: number; lines: FileTextLine[]; totalLines: number; truncatedByBytes?: boolean }): string {
  const endLine = outcome.lines.length > 0 ? outcome.lines[outcome.lines.length - 1].number : Math.max(0, outcome.offset - 1);
  let footer: string;
  if (outcome.truncatedByBytes) {
    footer = `(输出已封顶，显示第 ${outcome.offset}-${endLine} 行；用 offset=${endLine + 1} 继续。)`;
  } else if (endLine < outcome.totalLines) {
    footer = `(显示第 ${outcome.offset}-${endLine} 行，共 ${outcome.totalLines} 行；用 offset=${endLine + 1} 继续。)`;
  } else {
    footer = `(文件结束，共 ${outcome.totalLines} 行。)`;
  }
  const body = outcome.lines.length > 0
    ? `${outcome.lines.map((line) => `${line.number}: ${line.text}`).join("\n")}\n\n${footer}`
    : footer;
  return `<path>${display}</path>\n<type>file</type>\n<content>\n${body}\n</content>`;
}

/** 按扩展名粗推语言高亮提示（简化表，未知返回 undefined）。 */
export function langFromPath(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const table: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", mjs: "javascript", py: "python",
    java: "java", go: "go", rs: "rust", json: "json", md: "markdown", yml: "yaml",
    yaml: "yaml", html: "html", css: "css", sql: "sql", sh: "bash", ps1: "powershell"
  };
  return table[ext];
}

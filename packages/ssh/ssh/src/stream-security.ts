/**
 * 文件：stream-security.ts
 * 功能：对子进程 stdout/stderr 做受控采集：maxBytes 上限、超时、二进制守卫。
 * 作用：远端输出不可信——防止超大输出撑爆内存、防止二进制流被当作文本误读、超时强制终止。
 * 关联文件：packages/ssh/ssh/src/session.ts、protocol.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/ssh/ssh/src/stream-security.ts 的流安全语义。
 */

export interface CollectedOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly truncated: boolean;
  /** 输出含明显二进制字节（非 UTF-8 文本）。 */
  readonly binary: boolean;
}

const TEXT_BYTE_HINT = /[\x00-\x08\x0E-\x1F]/u;

/** 增量采集器：把流数据压入缓冲，超过 maxBytes 即截断并标记。 */
export class StreamCollector {
  private stdout: Buffer[] = [];
  private stderr: Buffer[] = [];
  private stdoutBytes = 0;
  private stderrBytes = 0;
  private truncated = false;
  private sawBinary = false;

  constructor(private readonly maxBytes: number) {}

  addStdout(chunk: Buffer): void {
    this.touch(chunk);
    if (this.stdoutBytes + chunk.length > this.maxBytes) {
      this.truncated = true;
      return;
    }
    this.stdout.push(chunk);
    this.stdoutBytes += chunk.length;
  }

  addStderr(chunk: Buffer): void {
    this.touch(chunk);
    if (this.stderrBytes + chunk.length > this.maxBytes) {
      this.truncated = true;
      return;
    }
    this.stderr.push(chunk);
    this.stderrBytes += chunk.length;
  }

  private touch(chunk: Buffer): void {
    if (this.sawBinary) return;
    // 抽样前 256 字节判断是否为二进制，避免对大输出做全量正则。
    const head = chunk.subarray(0, Math.min(chunk.length, 256)).toString("latin1");
    if (TEXT_BYTE_HINT.test(head)) this.sawBinary = true;
  }

  finish(): CollectedOutput {
    return {
      stdout: Buffer.concat(this.stdout).toString("utf8"),
      stderr: Buffer.concat(this.stderr).toString("utf8"),
      truncated: this.truncated,
      binary: this.sawBinary
    };
  }
}

/** 受控超时：返回 timer 与 clear 函数（已 unref，不阻止进程退出）。 */
export function withTimeout(ms: number, onTimeout: () => void): () => void {
  if (ms <= 0) return () => undefined;
  const timer = setTimeout(onTimeout, ms);
  timer.unref?.();
  return () => clearTimeout(timer);
}

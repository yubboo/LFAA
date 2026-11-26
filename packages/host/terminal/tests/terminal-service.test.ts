// 真实终端 Host 服务单测：起 PTY、写输入拿到回显、改尺寸、杀掉进程后池子里不再有它。
import assert from "node:assert/strict";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { TerminalService } from "../src/terminal-service";

const isWindows = process.platform === "win32";
/** PTY 里回车是 \r；PowerShell 与 sh 的 echo 写法一致，只有写法差异需要区分。 */
const MARKER = "LFAA_TERMINAL_OK";
const command = isWindows ? `Write-Output ${MARKER}\r` : `echo ${MARKER}\r`;

/** 等终端输出里出现某个标记，或超时。 */
function waitForOutput(service: TerminalService, sessionId: string, needle: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`等待终端输出超时：${needle}`));
    }, timeoutMs);
    const unsubscribe = service.subscribe(
      sessionId,
      (data) => {
        buffer += data;
        if (buffer.includes(needle)) {
          clearTimeout(timer);
          unsubscribe();
          resolve(buffer);
        }
      },
      () => {},
    );
  });
}

test("TerminalService 起 PTY、执行命令并回收", async () => {
  const service = new TerminalService(new Context(), { projectRoot: process.cwd(), maxSessions: 2 });
  try {
    const info = service.open({ sessionId: "test-1", cwd: process.cwd(), cols: 80, rows: 24 });
    assert.equal(info.running, true);
    assert.equal(service.has("test-1"), true);
    assert.equal(service.list().length, 1);

    // 等提示符出来再敲命令，避免输入落进初始化阶段。
    const output = waitForOutput(service, "test-1", MARKER);
    setTimeout(() => service.write("test-1", command), 300);
    const text = await output;
    assert.ok(text.includes(MARKER), `应看到命令回显：${text.slice(-160)}`);

    // 尺寸变化不应抛错，并被记录进快照。
    service.resize("test-1", 120, 40);
    assert.equal(service.list()[0]?.cols, 120);
    assert.equal(service.list()[0]?.rows, 40);

    service.kill("test-1");
    assert.equal(service.has("test-1"), false);
    assert.equal(service.list().length, 0);
  } finally {
    service.disposeAll();
  }
});

test("TerminalService 拒绝白名单外的 shell 与越界目录", () => {
  const service = new TerminalService(new Context(), { projectRoot: process.cwd(), allowedShells: ["powershell.exe"] });
  try {
    assert.throws(() => service.open({ sessionId: "bad-shell", cwd: process.cwd(), shell: "/bin/definitely-not-allowed" }), /不允许的 shell/u);
    // 越界 cwd 回退到项目根，不报错。
    const info = service.open({ sessionId: "bad-cwd", cwd: isWindows ? "C:/Windows/System32" : "/etc" });
    assert.equal(info.cwd, process.cwd());
    assert.equal(service.has("bad-cwd"), true);
  } finally {
    service.disposeAll();
  }
});
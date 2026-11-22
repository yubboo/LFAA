// 验证 pnpm 子进程调用层：安装来源拒绝 shell 元字符、Windows 命令行全部引用、优先绕开 shell。
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseInstallSpec } from "../src/catalog/install-spec";
import {
  UnsafePnpmArgumentError,
  assertSafePnpmArguments,
  buildWindowsPnpmCommandLine,
  findUnsafeSpecCharacter,
  quoteWindowsArgument,
  resolvePnpmSpawn,
} from "../src/manager/pnpm-spawn";

test("安装来源里的 shell 元字符被识别并拒绝", () => {
  assert.equal(findUnsafeSpecCharacter("git+https://evil.example/r&calc"), "&");
  assert.equal(findUnsafeSpecCharacter("pkg; rm -rf /"), ";");
  assert.equal(findUnsafeSpecCharacter("pkg%PATH%"), "%");
  assert.equal(findUnsafeSpecCharacter('pkg"x'), '"');
  // 合法来源不应被误伤。
  for (const spec of [
    "@scope/name@1.2.3",
    "zod@^3.22.0",
    "git+https://github.com/o/r.git#main",
    "github:owner/repo",
    "C:\\work\\plugins\\demo",
    "https://example.com/pkg-1.0.0.tgz",
  ]) {
    assert.equal(findUnsafeSpecCharacter(spec), null, `不应拒绝合法来源：${spec}`);
  }
});

test("解析层把带元字符的来源转成明确的用户错误，而不是继续拼参数", () => {
  assert.throws(
    () => parseInstallSpec("git+https://evil.example/r&calc"),
    (error: Error) => /不允许的字符「&」/u.test(error.message),
  );
});

test("Windows 命令行里 pnpm 与每个参数都被双引号包裹", () => {
  assert.equal(
    buildWindowsPnpmCommandLine(["add", "git+https://evil/r"]),
    '"pnpm" "add" "git+https://evil/r"',
  );
  assert.equal(
    buildWindowsPnpmCommandLine(["add", "pkg with space"]),
    '"pnpm" "add" "pkg with space"',
  );
});

test("参数里无法被引用中和的字符直接抛错，不做转义猜测", () => {
  assert.throws(() => assertSafePnpmArguments(['a"b']), UnsafePnpmArgumentError);
  assert.throws(() => assertSafePnpmArguments(["a%PATH%b"]), UnsafePnpmArgumentError);
  assert.throws(() => assertSafePnpmArguments(["a\nb"]), UnsafePnpmArgumentError);
});

test("cmd.exe 参数以反斜杠结尾时按 Windows 解析规则加倍", () => {
  const expected = `"C:\\dir\\\\"`;
  assert.equal(quoteWindowsArgument("C:\\dir\\"), expected);
});

test("Windows 无 pnpm 入口时退回 cmd.exe 转发，命令串仍整体引用", () => {
  const spawn = resolvePnpmSpawn(["add", "zod"], {
    platform: "win32",
    npmExecPath: undefined,
    comSpec: "cmd.exe",
  });
  assert.equal(spawn.command, "cmd.exe");
  assert.deepEqual(spawn.argv.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(spawn.argv[3], '"pnpm" "add" "zod"');
});

test("POSIX 直接执行 pnpm，参数以数组传递", () => {
  const spawn = resolvePnpmSpawn(["add", "zod"], { platform: "linux", npmExecPath: undefined });
  assert.equal(spawn.command, "pnpm");
  assert.deepEqual(spawn.argv, ["add", "zod"]);
});

test("能拿到 pnpm 的 JS 入口时改用 node 直接执行，完全不经过 shell", () => {
  const pnpmEntry = fileURLToPath(new URL("../../../../scripts/build.mjs", import.meta.url));
  const spawn = resolvePnpmSpawn(["add", "zod"], {
    platform: "win32",
    npmExecPath: pnpmEntry,
    nodePath: "C:\\node.exe",
  });
  assert.equal(spawn.command, "C:\\node.exe");
  assert.deepEqual(spawn.argv, [pnpmEntry, "add", "zod"]);
});
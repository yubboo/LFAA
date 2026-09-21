/**
 * 文件：windows-script-encoding-check.mjs
 * 作用：防止 Windows PowerShell 脚本因 BOM/UTF-8 或智能引号问题被错误解码或错误解析。
 * 负责：检查 scripts/windows/*.ps1 的 BOM、UTF-8 严格解码、智能引号语法安全和 launcher 入口约束。
 * 不负责：执行 PowerShell 业务逻辑、检查脚本运行结果、检查 BAT 中文显示效果。
 * 状态归属：无运行时状态；每次直接读取当前工作树字节。
 * 对外接口：`node scripts/windows-script-encoding-check.mjs`。
 * 关联文件：scripts/windows/*.ps1、LFAA-*.bat、docs/DEVELOPMENT.md、docs/RUNTIME.md。
 * 修改注意事项：Windows PowerShell 5.1 对无 BOM UTF-8 脚本兼容性不可靠；智能引号也会参与语法解析；禁止删除 BOM 或在 .ps1 中写 U+2018/U+2019/U+201C/U+201D。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const windowsScripts = path.join(root, "scripts", "windows");
const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
const decoder = new TextDecoder("utf-8", { fatal: true });
const smartQuotePattern = /[\u2018\u2019\u201c\u201d]/u;

const fail = (message) => {
  console.error(`LFAA Windows script encoding check failed: ${message}`);
  process.exit(1);
};

if (!fs.existsSync(windowsScripts)) fail("missing scripts/windows directory");

const ps1Files = fs.readdirSync(windowsScripts)
  .filter((name) => name.toLowerCase().endsWith(".ps1"))
  .sort();

if (ps1Files.length === 0) fail("no PowerShell scripts found");

for (const name of ps1Files) {
  const relative = `scripts/windows/${name}`;
  const bytes = fs.readFileSync(path.join(windowsScripts, name));

  if (bytes.length < 3 || !bytes.subarray(0, 3).equals(utf8Bom)) {
    fail(`${relative} must be UTF-8 with BOM (EF BB BF) for Windows PowerShell 5.1 compatibility`);
  }

  let text;
  try {
    text = decoder.decode(bytes.subarray(3));
  } catch {
    fail(`${relative} is not valid UTF-8 after BOM`);
  }

  const smartQuote = text.match(smartQuotePattern);
  if (smartQuote) {
    const offset = smartQuote.index ?? 0;
    const line = text.slice(0, offset).split(/\r?\n/u).length;
    fail(`${relative}:${line} contains a PowerShell smart quote (${JSON.stringify(smartQuote[0])}); use ASCII quotes for syntax or CJK brackets such as 「」 inside user-facing text`);
  }
}

const launchers = new Map([
  ["LFAA-Sync.bat", "scripts\\windows\\lfaa-sync.ps1"],
  ["LFAA-GitHub.bat", "scripts\\windows\\lfaa-github.ps1"],
  ["LFAA-Setup.bat", "scripts\\windows\\lfaa-setup.ps1"],
  ["LFAA-Update.bat", "scripts\\windows\\lfaa-update.ps1"],
]);

for (const [launcher, target] of launchers) {
  const absolute = path.join(root, launcher);
  if (!fs.existsSync(absolute)) fail(`missing launcher ${launcher}`);
  const text = fs.readFileSync(absolute, "utf8");
  if (!text.includes("powershell.exe") || !text.includes(target)) {
    fail(`${launcher} must invoke ${target} through powershell.exe`);
  }
}

console.log(`LFAA Windows script encoding check passed (${ps1Files.length} PowerShell scripts).`);

/**
 * 文件：windows-script-encoding-check.mjs
 * 作用：防止 Windows PowerShell 脚本因 UTF-8 BOM 丢失而在 PowerShell 5.1 中被错误解码。
 * 负责：检查 scripts/windows/*.ps1 的 BOM、UTF-8 严格解码和 launcher 入口约束。
 * 不负责：执行 PowerShell 业务逻辑、检查脚本运行结果、检查 BAT 中文显示效果。
 * 状态归属：无运行时状态；每次直接读取当前工作树字节。
 * 对外接口：`node scripts/windows-script-encoding-check.mjs`。
 * 关联文件：scripts/windows/*.ps1、LFAA-*.bat、docs/standards/QUALITY_GATES.md、docs/standards/WORKSPACE_SYNC.md。
 * 修改注意事项：Windows PowerShell 5.1 对无 BOM UTF-8 脚本兼容性不可靠；禁止为了“统一无 BOM”删除 .ps1 的 BOM。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const windowsScripts = path.join(root, "scripts", "windows");
const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
const decoder = new TextDecoder("utf-8", { fatal: true });

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

  try {
    decoder.decode(bytes.subarray(3));
  } catch {
    fail(`${relative} is not valid UTF-8 after BOM`);
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

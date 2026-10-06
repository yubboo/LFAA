import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const desktopPackage = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
const iconPath = resolve(packageRoot, desktopPackage.build.win.icon);
const installNoticePath = resolve(packageRoot, "assets/installation-notice.txt");

test("Windows 安装器绑定 LFAA 图标、同意须知与始终创建桌面快捷方式", async () => {
  const icon = await readFile(iconPath);
  const noticeBytes = await readFile(installNoticePath);
  assert.deepEqual(noticeBytes.subarray(0, 3), Buffer.from([0xef, 0xbb, 0xbf]));
  const notice = noticeBytes.subarray(3).toString("utf8");
  const nsis = desktopPackage.build.nsis;

  assert.equal(desktopPackage.build.win.icon, "assets/lfaa.ico");
  assert.equal(desktopPackage.build.win.artifactName, "LFAA-${version}.${ext}");
  assert.doesNotMatch(desktopPackage.build.win.artifactName, /\s/);
  assert.equal(nsis.license, "installation-notice.txt");
  assert.equal(nsis.allowToChangeInstallationDirectory, true);
  assert.equal(nsis.installerIcon, "lfaa.ico");
  assert.equal(nsis.uninstallerIcon, "lfaa.ico");
  assert.equal(nsis.createDesktopShortcut, "always");
  assert.equal(nsis.createStartMenuShortcut, true);
  assert.match(notice, /选择“我同意”表示你确认/);
  assert.match(notice, /选择拒绝会取消安装/);

  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  const count = icon.readUInt16LE(4);
  assert.ok(count >= 3);
  const dimensions = [];
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const size = icon[entry] || 256;
    const byteLength = icon.readUInt32LE(entry + 8);
    const offset = icon.readUInt32LE(entry + 12);
    dimensions.push(size);
    assert.deepEqual(icon.subarray(offset, offset + 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.ok(offset + byteLength <= icon.length);
  }
  assert.deepEqual(dimensions, [16, 32, 48, 256]);
});

test("NSIS 安装页显示详情并如实列出已安装的本机组件", async () => {
  const installer = await readFile(resolve(packageRoot, "nsis/installer.nsh"), "utf8");

  assert.match(installer, /ShowInstDetails show/);
  assert.match(installer, /SetDetailsPrint both/);
  assert.match(installer, /Control Plane 与 Daemon 运行组件已随程序安装/);
  assert.match(installer, /开始菜单与桌面快捷方式已创建/);
});

test("NSIS 安装文件状态使用低重绘模式并写入用户选择的安装目录", async () => {
  const installer = await readFile(resolve(packageRoot, "nsis/installer.nsh"), "utf8");
  const desktopRequire = createRequire(resolve(packageRoot, "package.json"));
  const electronBuilderManifest = desktopRequire.resolve("electron-builder/package.json");
  const electronBuilderRequire = createRequire(electronBuilderManifest);
  const appBuilderManifest = electronBuilderRequire.resolve("app-builder-lib/package.json");
  const installSection = await readFile(
    resolve(dirname(appBuilderManifest), "templates/nsis/installSection.nsh"),
    "utf8",
  );
  const detailModeOffset = installSection.indexOf("SetDetailsPrint listonly");
  const stableStatusOffset = installSection.indexOf("!insertmacro customInstallFilesStart");
  const outputPathOffset = installSection.indexOf("SetOutPath $INSTDIR");
  const copyFilesOffset = installSection.indexOf("!insertmacro installApplicationFiles");

  assert.match(installer, /!macro customInstallFilesStart\s+SetDetailsPrint textonly\s+DetailPrint "正在安装到：\$INSTDIR"\s+SetDetailsPrint listonly\s+!macroend/);
  assert.match(
    installSection,
    /\$\{IfNot\}\s+\$\{Silent\}\s+!ifmacrodef customInstallFilesStart\s+!insertmacro customInstallFilesStart\s+!else\s+SetDetailsPrint listonly\s+!endif\s+\$\{endif\}/,
  );
  assert.doesNotMatch(installSection, /SetDetailsPrint none/);
  assert.ok(stableStatusOffset >= 0 && detailModeOffset > stableStatusOffset);
  assert.ok(outputPathOffset > detailModeOffset && copyFilesOffset > outputPathOffset);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("本机 Java 选择器复用只读 Files Owner，并只返回可由本机 Runtime Owner 校验的 java.exe", () => {
  const panel = read("../../../packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx");
  const page = read("../../../packages/client/ui-layout/src/GameLibraryPage.tsx");
  const workbench = read("../../../packages/client/ui-layout/src/Workbench.tsx");
  const fileOwner = read("../../../packages/fs/fs/src/library.ts");

  assert.match(panel, /operateSystemFiles\(\{operation:"list",path:directory\},controller\.signal\)/u);
  assert.match(panel, /entry\.kind==="file"&&entry\.name\.toLocaleLowerCase\("en-US"\)==="java\.exe"/u);
  assert.match(panel, /source!=="local-drives"\|\|!drive\|\|!\/\^\[a-z\]\$\/iu\.test\(drive\)/u);
  assert.match(panel, /setPath\(selectedPath\);closeJavaPicker\(\)/u);
  assert.match(panel, /targetId!=="local"\|\|device\?\.platform!=="win32"/u);
  assert.match(panel, /operate\("register",\{executablePath:path\}\)/u, "仅用户点击登记后才创建 Java Runtime 任务");
  assert.match(workbench, /canBrowseLocalFiles=\{user\.role === "super_admin" && settings\.permissions\.mode === "full_access"\}/u);
  assert.match(fileOwner, /export function assertSystemFileAccess[\s\S]*?resolveUserRole\(userId\)\s*!==\s*"super_admin"[\s\S]*?permissions\.mode\s*!==\s*"full_access"/u);
  assert.match(page, /canBrowseLocalFiles:boolean/u);
});

test("Java 主版本的下载/复用仍由原 Runtime Manager 操作合同执行", () => {
  const panel = read("../../../packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx");
  const styles = read("../../../packages/client/ui-layout/src/GameLibraryPage.css");
  const page = read("../../../packages/client/ui-layout/src/GameLibraryPage.tsx");
  const javaOwner = read("../../../packages/host/runtime-environment/src/java-runtime.mjs");

  assert.match(panel, /const commonJavaVersions=\[\{major:8,label:"Java 8 · 旧版游戏兼容"\},\{major:11,label:"Java 11 · LTS"\},\{major:17,label:"Java 17 · LTS"\},\{major:21,label:"Java 21 · LTS"\},\{major:25,label:"Java 25 · 最新 LTS"\}\]/u);
  assert.match(panel, /<Select aria-label="选择常用 Java 版本" placeholder="请选择需要准备的版本"[\s\S]*?options=\{commonJavaVersions\.map/u);
  assert.doesNotMatch(panel, /InputNumber|major:7/u, "常用版本下拉不暴露 Java 7 或任意数字输入");
  assert.match(panel, /href=\{major\?`https:\/\/adoptium\.net\/temurin\/releases\/\?version=\$\{major\}`:"https:\/\/adoptium\.net\/temurin\/releases\/"\}/u);
  assert.match(panel, /operate\("install",\{major\}\)[\s\S]*?下载并准备所选版本/u);
  assert.match(panel, /device\?\.platform!=="win32"\|\|device\?\.architecture!=="x64"/u, "非 Windows x64 设备不能提交当前不支持的托管安装");
  assert.match(panel, /\[found\[0\]\.vendor,found\[0\]\.version\]\.filter\(Boolean\)\.join\(" · "\)/u, "已检测环境展示真实厂商和版本");
  assert.match(styles, /runtime-manager__java-version-selection \.ant-select \{ width: 100%; min-width: 0; max-width: 100%; \}/u);
  assert.match(javaOwner, /https:\/\/api\.adoptium\.net\/v3\/assets\/latest\/\$\{major\}\/hotspot/u);
  assert.match(javaOwner, /assertHttpsHost\(downloadUrl, "github\.com"\)/u);
  assert.match(javaOwner, /downloadCoreArtifact\(\{ url: downloadUrl, algorithm: "sha256", digest: expectedSha256 \}/u);
  assert.match(page, /runRuntimeOperation\(\{\s*targetId,\s*operation,\s*\.\.\.values\s*\}\)/u);
});

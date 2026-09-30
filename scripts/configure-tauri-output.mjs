/**
 * 功能：把 Tauri 自动生成的权限模式文件固定到根 dist。
 * 作用：源码中的 gen 只提供目录链接；Cargo、开发和打包均写入同一受管理输出目录。
 * 关联文件：desktop-tauri 的 build.rs、run-tauri-dev.mjs、package-windows.mjs。
 */
import { mkdir, lstat, realpath, cp, rm, symlink } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function configureTauriOutput() {
  const source = resolve(root, "apps/desktop-tauri/src-tauri/gen");
  const destination = resolve(root, "dist/apps/desktop-tauri/gen");
  for (const path of [source, destination]) {
    const inside = relative(root, path);
    if (!inside || inside === ".." || inside.startsWith(`..${sep}`)) throw new Error("Tauri 生成目录越出工作区。");
  }
  await mkdir(destination, { recursive: true });
  let info;
  try { info = await lstat(source); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (info?.isSymbolicLink()) {
    if ((await realpath(source)).toLocaleLowerCase() !== (await realpath(destination)).toLocaleLowerCase()) throw new Error("Tauri gen 指向了非预期目录。");
    return;
  }
  if (info) {
    if (!info.isDirectory()) throw new Error("Tauri gen 必须是生成目录。");
    // 仅处理已经确认的源码生成目录；保留其文件后建立目录链接。
    const resolvedSource = await realpath(source);
    if (resolvedSource.toLocaleLowerCase() !== source.toLocaleLowerCase()) throw new Error("拒绝替换工作区外的生成目录。");
    await cp(source, destination, { recursive: true });
    await rm(source, { recursive: true });
  }
  await symlink(destination, source, process.platform === "win32" ? "junction" : "dir");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await configureTauriOutput();

/** SteamCMD 初次安装原子提升：允许空目录/空占位文件，拒绝覆盖用户内容。 */
import {lstat,readdir,rename,rmdir,unlink,writeFile,rm} from "node:fs/promises";
import {resolve} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
const execute=promisify(execFile);

/** 仅客户端确实被自更新替换且更新器非零退出时，继续一次版本核验。 */
export async function initializeSteamcmd(executable,options,onUpdate,runner=execute) {
  const deadline=Date.now()+options.timeout;
  const before=await lstat(executable);
  let output;
  try {output=await runner(executable,["+quit"],options);}
  catch(error){
    const after=await lstat(executable);
    if(error.killed||error.signal||![1,-1,4294967295].includes(Number(error.code))||before.size===after.size&&before.mtimeMs===after.mtimeMs||Date.now()>=deadline)throw error;
    await onUpdate?.();
    output=await runner(executable,["+quit"],{...options,timeout:Math.max(1,deadline-Date.now())});
  }
  const versionLine=`${output.stdout??""}\n${output.stderr??""}`.split(/\r?\n/u).find(line=>/Steam Console Client/iu.test(line));
  if(!versionLine)throw new Error("SteamCMD 未返回真实客户端版本输出，未确认环境可用。");
  return versionLine.trim().slice(0,120);
}

export async function promoteSteamcmdInstallation(stagingDirectory,toolDirectory,assertSafePath) {
  const previousDirectory=`${stagingDirectory}.previous-empty`;
  for(const path of [stagingDirectory,toolDirectory,previousDirectory])await assertSafePath(path,true);
  const stageInfo=await lstat(stagingDirectory);
  if(!stageInfo.isDirectory()||stageInfo.isSymbolicLink())throw new Error("SteamCMD 临时安装目录无效。");
  const entries=await readdir(toolDirectory);
  if(entries.some(name=>name!==".gitkeep"))throw new Error("所选 SteamCMD 目录已包含其他文件；请换用空目录或现有 SteamCMD 目录。");
  const keepPath=resolve(toolDirectory,".gitkeep");
  if(entries.length){
    await assertSafePath(keepPath);
    const keep=await lstat(keepPath);
    if(!keep.isFile()||keep.isSymbolicLink()||keep.size!==0||keep.nlink!==1)throw new Error("SteamCMD 目录包含非空或不安全的占位文件，未覆盖。");
    await writeFile(resolve(stagingDirectory,".gitkeep"),"",{flag:"wx"});
  }
  if(await lstat(previousDirectory).catch(error=>{if(error.code==="ENOENT")return null;throw error;}))throw new Error("SteamCMD 安装回退目录已存在，未覆盖。");
  await rename(toolDirectory,previousDirectory);
  try {await rename(stagingDirectory,toolDirectory);}
  catch(error){await rename(previousDirectory,toolDirectory);throw error;}
  // 只清理仍为空的原占位目录；如果其他进程新增文件，保留回退目录。
  try {
    if(entries.length){const keep=await lstat(resolve(previousDirectory,".gitkeep"));if(!keep.isFile()||keep.size!==0||keep.nlink!==1)return;await unlink(resolve(previousDirectory,".gitkeep"));}
    await rmdir(previousDirectory);
  }catch{/* 不递归删除并发新增的用户内容。 */}
}

/** 完整删除经安全路径校验的专用 SteamCMD 工具目录；调用方负责校验节点服务器已停止。 */
export async function removeSteamcmdInstallation(toolDirectory,assertSafePath) {
  await assertSafePath(toolDirectory,true);
  let info;
  try {info=await lstat(toolDirectory);}
  catch(error){if(error?.code==="ENOENT")return false;throw error;}
  if(!info.isDirectory()||info.isSymbolicLink())throw new Error("SteamCMD 工具路径不是安全的普通目录，未卸载。");
  await rm(toolDirectory,{recursive:true,force:false,maxRetries:3,retryDelay:100});
  try {await lstat(toolDirectory);throw new Error("SteamCMD 工具目录卸载后仍存在，状态未确认。");}
  catch(error){if(error?.code!=="ENOENT")throw error;}
  return true;
}

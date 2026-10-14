/** 功能：本机和 Daemon 共用的环境执行适配。作用：把结构化操作映射到同一 Java 实现，提供真实检测、取消和安装后验证。 */
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {createJavaRuntimeManager} from "./java-runtime.mjs";
import {createRuntimeIO} from "./runtime-io.mjs";
import {downloadCoreArtifact} from "./download.mjs";
import {fetchRuntimeResource} from "./network.mjs";
import {discoverWindowsRuntimes,downloadWindowsRuntime} from "./windows-runtimes.mjs";

export function createRuntimeExecutor({dataDirectory,repositoryRoot,storage,signal,activeServers,postTaskProgress,checkDependencies=async()=>{}}) {
  const javaDirectory=resolve(storage.runtimeDirectory,"Java");
  const downloadDirectory=resolve(storage.downloadCacheDirectory,"minecraft-downloads");
  const io=createRuntimeIO({roots:[dataDirectory,storage.runtimeDirectory,storage.downloadCacheDirectory,storage.temporaryDirectory,...(storage.previousRuntimeDirectories??[])],signal});
  const manager=createJavaRuntimeManager({dataDirectory,repositoryRoot,javaDirectory,downloadDirectory,temporaryDirectory:storage.temporaryDirectory,previousRuntimeDirectories:storage.previousRuntimeDirectories,...io,activeServers,postTaskProgress,fetchResource:(url,options)=>fetchRuntimeResource(url,{...options,signal:signal?AbortSignal.any([signal,options.signal]):options.signal}),
    downloadCoreArtifact:(artifact,path,timeout,progress)=>downloadCoreArtifact(artifact,path,timeout,progress,signal,fetchRuntimeResource)});
  async function list(){const found=await manager.discoverJavaRuntimes();const detectedAt=new Date().toISOString();return [...found.map(runtime=>({...runtime,type:"java",available:true,detectedAt})),...await discoverWindowsRuntimes(io)];}
  async function execute(operation,payload,progress){
    signal?.throwIfAborted();
    if(["install","register","update"].includes(operation))for(const directory of [javaDirectory,downloadDirectory,storage.temporaryDirectory]){await io.assertSafeFileTarget(directory);await mkdir(directory,{recursive:true});}
    await progress?.(5,"正在核对执行设备和运行环境。");
    if(operation==="install"&&payload.packageId)return downloadWindowsRuntime(payload.packageId,storage,io,payload.downloadTimeoutSeconds,signal,progress);
    if(operation==="detect")return {runtimes:await list()};
    if(operation==="install") {
      const existing=(await list()).find(runtime=>runtime.major===payload.major);
      if(existing){await progress?.(100,`已验证并复用现有 Java ${payload.major}，没有下载。`);return {reused:true,runtime:existing,runtimes:await list()};}
      if(process.platform!=="win32"||process.arch!=="x64")throw new Error("当前托管 Java 安装适配器支持 Windows x64；此平台可以检测和登记现有环境。");
      await manager.installTemurinRuntime(payload.major,progress,payload.downloadTimeoutSeconds);
      const runtime=await manager.findJavaRuntime(payload.major,true);if(!runtime)throw new Error("安装结束但没有发现可执行的对应 Java，不能报告成功。");
      return {reused:false,runtime,runtimes:await list()};
    }
    if(operation==="register") {await manager.registerJavaRuntimePath({executablePath:payload.executablePath,runtimeId:payload.runtimeId},progress);return {runtimes:await list()};}
    if(operation==="forget") {const runtime=(await list()).find(item=>item.runtimeId===payload.runtimeId);if(runtime)await checkDependencies(runtime);await manager.forgetJavaRuntimePath(payload.runtimeId,progress);return {runtimes:await list()};}
    const runtime=(await manager.discoverJavaRuntimes()).find(item=>item.runtimeId===payload.runtimeId);if(!runtime)throw new Error("所选运行环境已不在当前设备检测结果中。");
    if(operation==="verify"){const checked=await manager.readJavaVersion(runtime.executablePath);if(checked.major!==runtime.major)throw new Error("Java 实际版本已改变，请重新检测后选择。");return {runtime:{...runtime,...checked},verified:true};}
    if(operation==="update"){if(!runtime.managed)throw new Error("只更新当前目录中 LFAA 管理的环境。");await checkDependencies(runtime);const result=await manager.updateTemurinRuntime(runtime.major,progress,payload.downloadTimeoutSeconds);return {...result,runtimes:await list()};}
    if(operation==="remove") {if(!runtime.managed)throw new Error("只允许卸载当前托管目录的环境，外部环境可以移除登记。");await checkDependencies(runtime);await manager.uninstallTemurinRuntime(runtime.major,progress);return {removed:true,runtimes:await list()};}
    throw new Error("当前环境操作尚未接入，未执行任何替代动作。");
  }
  return {manager,list,execute};
}

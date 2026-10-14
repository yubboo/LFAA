/** 功能：共享运行环境的安全文件、进程与 ZIP 操作。作用：本机/节点使用相同路径与校验边界，不依赖 Daemon 在线。 */
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {lstat,mkdir,readdir,realpath} from "node:fs/promises";
import {basename,dirname,isAbsolute,parse,relative,resolve,sep} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
const exec = promisify(execFile);

export function createRuntimeIO({roots,signal}) {
  const allowed = roots.map(root=>resolve(root));
  const within = path=>allowed.some(root=>{const rel=relative(root,resolve(path));return rel==="" || rel!==".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);});
  async function assertSafeFileTarget(path,allowMissing=true) {
    const target=resolve(path);if(!within(target))throw new Error("运行环境路径超出已配置存储位置。");
    const volume=parse(target).root;let current=volume;
    for(const segment of relative(volume,target).split(sep).filter(Boolean)) {
      current=resolve(current,segment);const info=await lstat(current).catch(error=>{if(allowMissing&&error.code==="ENOENT")return null;throw error;});
      if(!info)continue;
      const actual=await realpath(current);const same=process.platform==="win32"?actual.toLowerCase()===current.toLowerCase():actual===current;
      if(info.isSymbolicLink()||!same||info.isFile()&&info.nlink>1)throw new Error("运行环境路径包含链接或重解析点，拒绝操作。");
    }
    return target;
  }
  async function fileExists(path){try{await lstat(path);return true;}catch(error){if(error.code==="ENOENT")return false;throw error;}}
  async function findExecutable(root,name){
    const pending=[{path:root,depth:0}];let visited=0;
    while(pending.length&&visited++<4096){signal?.throwIfAborted();const current=pending.pop();const info=await lstat(current.path).catch(()=>null);if(!info?.isDirectory()||info.isSymbolicLink()||current.depth>8)continue;for(const entry of await readdir(current.path,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const path=resolve(current.path,entry.name);if(entry.isFile()&&entry.name.toLowerCase()===name.toLowerCase())return path;if(entry.isDirectory())pending.push({path,depth:current.depth+1});}}
    return null;
  }
  async function captureProcess(executable,args,timeout,env){
    signal?.throwIfAborted();
    const clean={};for(const key of ["SystemRoot","WINDIR","ComSpec","SystemDrive","PATH","JAVA_HOME","TEMP","TMP","HOME","LANG","ProgramFiles","ProgramFiles(x86)","ProgramW6432","USERPROFILE"])if(process.env[key])clean[key]=process.env[key];
    const commandIndex=args.indexOf("-Command");
    if(basename(executable).toLowerCase()==="powershell.exe"&&commandIndex>=0){args=[...args];args[commandIndex+1]="$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);"+args[commandIndex+1];}
    try{return await exec(executable,args,{windowsHide:true,shell:false,timeout,maxBuffer:4*1024*1024,encoding:"utf8",signal,env:{...clean,...env}});}
    catch(error){if(signal?.aborted)throw signal.reason;throw new Error(`运行环境命令执行失败：${error.stderr?.trim()||error.message}`,{cause:error});}
  }
  async function hashFile(path,algorithm){await assertSafeFileTarget(path,false);const hash=createHash(algorithm);for await(const chunk of createReadStream(path)){signal?.throwIfAborted();hash.update(chunk);}return hash.digest("hex");}
  async function expandZip(path,destination){
    if(process.platform!=="win32")throw new Error("此运行环境 ZIP 安装适配器当前仅支持 Windows，未执行不受支持的解压。");
    await assertSafeFileTarget(path,false);await assertSafeFileTarget(destination);await mkdir(destination,{recursive:true});
    const script="$ErrorActionPreference='Stop';Add-Type -AssemblyName System.IO.Compression.FileSystem;$root=[IO.Path]::GetFullPath($env:LFAA_RUNTIME_DEST).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar;$zip=[IO.Compression.ZipFile]::OpenRead($env:LFAA_RUNTIME_ARCHIVE);try{foreach($entry in $zip.Entries){$target=[IO.Path]::GetFullPath([IO.Path]::Combine($root,$entry.FullName));if(-not $target.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)-or (($entry.ExternalAttributes -shr 16)-band 61440)-eq 40960){throw 'ZIP path rejected'}}}finally{$zip.Dispose()};Expand-Archive -LiteralPath $env:LFAA_RUNTIME_ARCHIVE -DestinationPath $env:LFAA_RUNTIME_DEST -Force";
    await captureProcess("powershell.exe",["-NoLogo","-NoProfile","-NonInteractive","-Command",script],180000,{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,LFAA_RUNTIME_DEST:destination,LFAA_RUNTIME_ARCHIVE:path});
  }
  return {assertSafeFileTarget,fileExists,findExecutable,captureProcess,hashFile,expandZip,requireMajor(value){if(!Number.isInteger(value)||value<8||value>40)throw new Error("Java 主版本无效。");return value;},assertHttpsHost(value,host){const url=new URL(value);if(url.protocol!=="https:"||url.hostname!==host||url.username||url.password)throw new Error("运行环境来源未通过官方 HTTPS 校验。");},safeMessage(error){return error instanceof Error?error.message:String(error);}};
}

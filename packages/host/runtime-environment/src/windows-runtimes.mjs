/** Windows 游戏运行库目录、真实检测和官方安装包下载。下载完成不等于已安装。 */
import {mkdir,open,rename,rm} from "node:fs/promises";
import {resolve} from "node:path";
import {pipeline} from "node:stream/promises";
import {Transform} from "node:stream";
import {randomUUID} from "node:crypto";
import {fetchRuntimeResource} from "./network.mjs";
import {isRetryableDownloadError} from "./download.mjs";

export const windowsRuntimeCatalog=[
  {id:"vcredist-x64",type:"visual-cpp",name:"Visual C++ v14",architecture:"x64",filename:"vc_redist.x64.exe",url:"https://aka.ms/vc14/vc_redist.x64.exe"},
  {id:"vcredist-x86",type:"visual-cpp",name:"Visual C++ v14",architecture:"x86",filename:"vc_redist.x86.exe",url:"https://aka.ms/vc14/vc_redist.x86.exe"},
  {id:"directx-jun2010",type:"directx",name:"DirectX 旧版游戏组件",architecture:"x86 / x64",filename:"directx_Jun2010_redist.exe",url:"https://download.microsoft.com/download/8/4/a/84a35bf1-dafe-4ae8-82af-ad2ae20b6b14/directx_Jun2010_redist.exe"}
];
export async function discoverWindowsRuntimes(io) {
  if(process.platform!=="win32")return [];
  // 不使用 Win32_Product；单次只读注册表查询，不触发 MSI 修复或全盘扫描。
  const script="$ErrorActionPreference='Stop';$items=@();foreach($arch in @('x64','x86')){$key=Get-ItemProperty -LiteralPath ('HKLM:\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\'+$arch) -ErrorAction SilentlyContinue;if(-not $key){$key=Get-ItemProperty -LiteralPath ('HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\'+$arch) -ErrorAction SilentlyContinue};$folder=if($arch -eq 'x64'){'System32'}else{'SysWOW64'};$binary=Join-Path $env:WINDIR ($folder+'\\vcruntime140.dll');if($key.Installed -eq 1 -and (Test-Path -LiteralPath $binary)){$items+=@{runtimeId=('vcredist-'+$arch);type='visual-cpp';version=$key.Version;architecture=$arch;executablePath=$binary;vendor='Microsoft';managed=$false;source='system';available=$true}}};$dx=Join-Path $env:WINDIR 'System32\\d3dx9_43.dll';if(Test-Path -LiteralPath $dx){$items+=@{runtimeId='directx-jun2010';type='directx';version=(Get-Item -LiteralPath $dx).VersionInfo.FileVersion;executablePath=$dx;vendor='Microsoft';managed=$false;source='system';available=$true;note='已发现 D3DX9_43；其他旧版组件按游戏需要核验'}};ConvertTo-Json -InputObject @($items) -Compress";
  const result=await io.captureProcess("powershell.exe",["-NoLogo","-NoProfile","-NonInteractive","-Command",script],10000);
  const rows=JSON.parse(result.stdout.replace(/^\uFEFF/u,""));
  if(!Array.isArray(rows))throw new Error("Windows 运行库检测返回无效结果。");
  return rows.map(row=>({...row,detectedAt:new Date().toISOString()}));
}
function officialUrl(value){const url=new URL(value);if(url.protocol!=="https:"||url.username||url.password||url.port&&url.port!=="443"||!["aka.ms","download.visualstudio.microsoft.com","download.microsoft.com"].includes(url.hostname))throw new Error("安装包跳转未通过 Microsoft 官方 HTTPS 来源校验。");return url;}
export async function downloadWindowsRuntime(packageId,storage,io,timeoutSeconds,signal,progress,resourceFetch=fetchRuntimeResource) {
  if(!Number.isInteger(timeoutSeconds)||timeoutSeconds<30||timeoutSeconds>7200)throw new Error("缺少有效的运行库下载时限配置。");
  const item=windowsRuntimeCatalog.find(row=>row.id===packageId);
  if(!item)throw new Error("未登记此 Windows 运行库安装包。");
  if(process.platform!=="win32")throw new Error("此安装包签名核验需要 Windows 目标设备。");
  const directory=resolve(storage.runtimeDirectory,item.type==="visual-cpp"?"VisualCpp":"DirectX");
  await io.assertSafeFileTarget(directory);await mkdir(directory,{recursive:true});
  const temporary=resolve(directory,`.download-${randomUUID()}.exe`),destination=resolve(directory,item.filename);
  await io.assertSafeFileTarget(destination);
  const deadline=Date.now()+timeoutSeconds*1000;
  const budget=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(timeoutSeconds*1000)]);
  try {
    for(let attempt=0;attempt<2;attempt++) {
      try {
        let url=officialUrl(item.url),response;
        for(let redirect=0;redirect<6;redirect++) {
          response=await resourceFetch(url,{signal:budget,redirect:"manual"});
          if(![301,302,303,307,308].includes(response.status))break;
          const next=response.headers.get("location");await response.body?.cancel();
          if(!next||redirect===5)throw new Error("Microsoft 下载跳转无效。");url=officialUrl(new URL(next,url));
        }
        if(!response?.ok||!response.body){await response?.body?.cancel();throw new Error(`Microsoft 下载失败（${response?.status}）。`);}
        let bytes=0;const limit=128*1024*1024;
        if(Number(response.headers.get("content-length"))>limit){await response.body.cancel();throw new Error("运行库安装包超过安全体积上限。");}
        const file=await open(temporary,"wx");
        try {await pipeline(response.body,new Transform({transform(chunk,_encoding,done){bytes+=chunk.length;done(bytes>limit?new Error("安装包超过安全上限。"):null,chunk);}}),file.createWriteStream(),{signal:budget});}
        finally{await file.close().catch(()=>{});}
        const total=Number(response.headers.get("content-length"));
        if(bytes===0||total>0&&bytes!==total)throw new Error("官方安装包为空或下载不完整。");
        break;
      }catch(error){await rm(temporary,{force:true});if(attempt===1||budget.aborted||!isRetryableDownloadError(error))throw error;}
    }
    await progress?.(85,"正在核验 Microsoft 安装包的 Windows 数字签名。");
    const script="Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -ErrorAction Stop;$s=Get-AuthenticodeSignature -LiteralPath $env:LFAA_RUNTIME_INSTALLER;if($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation(?:,|$)'){throw 'Microsoft signature validation failed'}";
    budget.throwIfAborted();
    await io.captureProcess("powershell.exe",["-NoLogo","-NoProfile","-NonInteractive","-Command",script],Math.max(1,deadline-Date.now()),{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,LFAA_RUNTIME_INSTALLER:temporary});
    budget.throwIfAborted();await rename(temporary,destination);
    return {downloaded:true,installed:false,packageId,installerPath:destination,message:"官方安装包已下载并通过 Microsoft 数字签名核验；尚未运行安装器。"};
  }finally{await rm(temporary,{force:true});}
}

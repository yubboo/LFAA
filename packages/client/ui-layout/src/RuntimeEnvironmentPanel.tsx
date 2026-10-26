/** 共享环境分类界面：安装状态只来自设备检测，实例所需版本独立呈现。 */
import {useEffect,useRef,useState} from "react";
import {Alert,Button,Empty,Input,Modal,Popconfirm,Select,Spin,Tag,Typography} from "antd";
import {createSteamcmdTask,loadSteamcmdSettings,loadSteamcmdTask,getErrorMessage,operateSystemFiles,type ManagedFileEntry,type SteamcmdSettingsNode,type SteamcmdTask} from "lfaa-client-connection/src/api.js";
import type {RuntimeOverview,RuntimeTask} from "lfaa-client-connection/src/runtime-api.js";
import {createReadPoller} from "lfaa-client-connection/src/read-poller.js";
import {WorkbenchIcon} from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

type Category="java"|"steamcmd"|"visual-cpp"|"directx";
const categories=[{id:"java",title:"Java 环境",icon:"bolt"},{id:"steamcmd",title:"SteamCMD",icon:"terminal"},{id:"visual-cpp",title:"Microsoft Visual C++",icon:"grid"},{id:"directx",title:"DirectX",icon:"monitor"}] as const;
const commonJavaVersions=[{major:8,label:"Java 8 · 旧版游戏兼容"},{major:11,label:"Java 11 · LTS"},{major:17,label:"Java 17 · LTS"},{major:21,label:"Java 21 · LTS"},{major:25,label:"Java 25 · 最新 LTS"}] as const;
function localWindowsPath(fileManagerPath:string):string|null {
  const [source,drive,...parts]=fileManagerPath.split("/");
  if(source!=="local-drives"||!drive||!/^[a-z]$/iu.test(drive))return null;
  return `${drive.toLocaleUpperCase("en-US")}:\\${parts.join("\\")}`;
}
function localPathLabel(fileManagerPath:string):string {
  if(fileManagerPath==="local-drives")return "本机磁盘";
  return localWindowsPath(fileManagerPath)??"本机磁盘";
}
function javaExecutableEntry(entry:ManagedFileEntry):boolean {
  return entry.kind==="file"&&entry.name.toLocaleLowerCase("en-US")==="java.exe";
}
function EnvironmentIcon({category}:{category:Category}) {
  if(category==="java")return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 8h13v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z"/><path d="M17 9h2a3 3 0 0 1 0 6h-2M7 3v2m4-3v3m4-2v2" strokeLinecap="round"/></svg>;
  if(category==="visual-cpp")return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z M3 7l9 5 9-5M12 12v10M7 5l10 5"/></svg>;
  return <WorkbenchIcon name={category==="directx"?"monitor":"terminal"} size={20}/>;
}
export function RuntimeEnvironmentPanel({overview,targetId,setTargetId,canOperate,canBrowseLocalFiles,operate,task,onNavigate,onOpenStorage,onOpenSteamcmd,onManageSteamcmd}:{
  overview:RuntimeOverview|null;targetId:string;setTargetId:(id:string)=>void;canOperate:boolean;canBrowseLocalFiles:boolean;
  operate:(operation:string,values?:Record<string,unknown>)=>Promise<void>;task:RuntimeTask|null;
  onNavigate:(path:string)=>void;onOpenStorage:()=>void;onOpenSteamcmd:()=>void;onManageSteamcmd:(nodeId:string)=>void;
}) {
  const [category,setCategory]=useState<Category>("java"),[major,setMajor]=useState<number|null>(null),[path,setPath]=useState("");
  const [steamTask,setSteamTask]=useState<SteamcmdTask|null>(null),[steamBusy,setSteamBusy]=useState(false),[steamSettingsNodes,setSteamSettingsNodes]=useState<SteamcmdSettingsNode[]>([]),[error,setError]=useState("");
  const [javaPickerOpen,setJavaPickerOpen]=useState(false),[javaPickerPath,setJavaPickerPath]=useState("local-drives"),[javaPickerEntries,setJavaPickerEntries]=useState<ManagedFileEntry[]>([]),[javaPickerLoading,setJavaPickerLoading]=useState(false),[javaPickerTruncated,setJavaPickerTruncated]=useState(false),[javaPickerError,setJavaPickerError]=useState("");
  const javaPickerRequest=useRef(0),javaPickerAbort=useRef<AbortController|null>(null);
  const steamAutoTargeted=useRef(false);
  const device=overview?.devices.find(item=>item.id===targetId);
  const operationRuntimes=task?.targetId===targetId&&task.status==="succeeded"&&task.operation==="detect"&&Array.isArray((task.result as {runtimes?:unknown[]})?.runtimes)?(task.result as {runtimes:RuntimeOverview["devices"][number]["runtimes"]}).runtimes:null;
  const runtimes=operationRuntimes??device?.runtimes??[];
  const online=device?.status==="online",enabled=canOperate&&online;
  const explicitTarget=new URLSearchParams(window.location.search).has("target");
  const steamNode=device&&device.id!=="local"&&device.platform==="win32"&&device.architecture==="x64";
  const steamTargetSettings=steamSettingsNodes.find(item=>item.id===targetId);
  const steamTaskActive=steamTask?.nodeId===targetId&&["queued","running"].includes(steamTask.status);
  const steamInstalled=steamTask?.nodeId===targetId&&steamTask.status==="succeeded"&&steamTask.result?.verified===true
    ||runtimes.some(item=>item.type==="steamcmd"&&item.available)&&online;
  const java=runtimes.filter(item=>item.type==="java"),majors=[...new Set([...commonJavaVersions.map(item=>item.major),...java.map(item=>item.major!).filter(Boolean)])].sort((a,b)=>a-b);
  const returnValue=new URLSearchParams(window.location.search).get("return");
  const returnPath=returnValue==="minecraft"?"/games/minecraft/deployment":returnValue==="overview"?"/games/minecraft/overview":returnValue&&/^[a-f0-9-]{36}$/iu.test(returnValue)?`/games/minecraft/instance/${returnValue}/overview`:null;
  const closeJavaPicker=()=>{javaPickerRequest.current+=1;javaPickerAbort.current?.abort();javaPickerAbort.current=null;setJavaPickerOpen(false);setJavaPickerLoading(false);};
  const browseJavaDirectory=async(directory:string)=>{
    javaPickerAbort.current?.abort();
    const controller=new AbortController(),request=++javaPickerRequest.current;
    javaPickerAbort.current=controller;setJavaPickerPath(directory);setJavaPickerEntries([]);setJavaPickerError("");setJavaPickerLoading(true);
    try{
      const {result}=await operateSystemFiles({operation:"list",path:directory},controller.signal);
      if(controller.signal.aborted||request!==javaPickerRequest.current)return;
      setJavaPickerEntries(Array.isArray(result.entries)?result.entries as ManagedFileEntry[]:[]);setJavaPickerTruncated(result.truncated===true);
    }catch(reason){if(!controller.signal.aborted&&request===javaPickerRequest.current)setJavaPickerError(getErrorMessage(reason));}
    finally{if(request===javaPickerRequest.current){setJavaPickerLoading(false);javaPickerAbort.current=null;}}
  };
  const openJavaPicker=()=>{if(!canBrowseLocalFiles||targetId!=="local"||device?.platform!=="win32")return;setJavaPickerOpen(true);void browseJavaDirectory("local-drives");};
  const selectJavaExecutable=(entry:ManagedFileEntry)=>{
    if(!javaExecutableEntry(entry))return;
    const selectedPath=localWindowsPath(entry.path);
    if(!selectedPath){setJavaPickerError("无法将此文件位置映射为本机 Windows 绝对路径。");return;}
    setPath(selectedPath);closeJavaPicker();
  };
  const javaPickerParent=javaPickerPath.includes("/")?javaPickerPath.slice(0,javaPickerPath.lastIndexOf("/")):"";
  const javaPickerDirectories=javaPickerEntries.filter(entry=>entry.kind==="directory");
  const javaPickerFiles=javaPickerEntries.filter(javaExecutableEntry);
  useEffect(()=>()=>{javaPickerRequest.current+=1;javaPickerAbort.current?.abort();},[]);
  useEffect(()=>{if(!canBrowseLocalFiles||targetId!=="local")closeJavaPicker();},[canBrowseLocalFiles,targetId]);
  useEffect(()=>{if(!steamTask||!["queued","running"].includes(steamTask.status))return;let active=true;const poller=createReadPoller(async()=>{try{const value=await loadSteamcmdTask(steamTask.id);if(active)setSteamTask(value.task);if(!["queued","running"].includes(value.task.status))poller.stop();}catch(reason){if(active)setError(getErrorMessage(reason));}},1500);return()=>{active=false;poller.stop();};},[steamTask?.id]);
  useEffect(()=>{
    if(category!=="steamcmd"||explicitTarget||targetId!=="local"||!overview||steamAutoTargeted.current)return;
    steamAutoTargeted.current=true;
    const candidate=overview.devices.find(item=>item.id!=="local"&&item.status==="online"&&item.platform==="win32"&&item.architecture==="x64");
    if(candidate)setTargetId(candidate.id);
  },[category,explicitTarget,overview,setTargetId,targetId]);
  useEffect(()=>{
    if(category!=="steamcmd"||targetId==="local"||!canOperate)return;
    let active=true;
    void loadSteamcmdSettings().then(value=>{if(active)setSteamSettingsNodes(value.nodes);}).catch(reason=>{if(active)setError(getErrorMessage(reason));});
    return()=>{active=false;};
  },[canOperate,category,targetId]);
  const steamAction=async(kind:"install"|"verify"|"uninstall")=>{setSteamBusy(true);setError("");try{setSteamTask((await createSteamcmdTask({nodeId:targetId,kind})).task);}catch(reason){setError(getErrorMessage(reason));}finally{setSteamBusy(false);}};
  return <>
    <section className="game-library__environment-controls game-library__environment-controls--toolbar" aria-label="运行环境管理">
      <label><span className="game-library__environment-device-label" title="执行设备"><WorkbenchIcon name="monitor" size={16}/><span>执行设备</span></span><Select aria-label="运行环境执行设备" value={targetId} onChange={setTargetId} options={overview?.devices.map(item=>({value:item.id,label:`${item.displayName} · ${item.status==="online"?"在线":"离线"}`}))}/></label>
      <Button className="game-library__environment-action" aria-label="重新检测环境" title="重新检测环境" icon={<WorkbenchIcon name="refresh" size={16}/>} disabled={!enabled} onClick={()=>void operate("detect")}><span className="game-library__action-label">重新检测环境</span></Button><Button className="game-library__environment-action" aria-label="项目与存储设置" title="项目与存储设置" icon={<WorkbenchIcon name="settings" size={16}/>} onClick={onOpenStorage}><span className="game-library__action-label">项目与存储设置</span></Button>
      {returnPath?<Button type="primary" onClick={()=>onNavigate(returnPath)}>{returnValue==="minecraft"?"返回部署草稿":"返回 Minecraft"}</Button>:null}
    </section>
    {error?<Alert type="error" showIcon message={error}/>:null}
    {!online&&device?<Alert type="warning" showIcon message="设备离线，以下为历史记录，不能确认当前可用。"/>:null}
    <section className="runtime-manager">
      <nav className="runtime-manager__tabs" aria-label="运行环境分类">{categories.map(item=><button type="button" aria-pressed={category===item.id} key={item.id} onClick={()=>setCategory(item.id)}><EnvironmentIcon category={item.id}/>{item.title}</button>)}</nav>
      <div className="runtime-manager__body">
        <div className="runtime-manager__heading"><Typography.Title level={2}>{categories.find(item=>item.id===category)?.title}</Typography.Title><Typography.Paragraph>{category==="java"?"按真实版本复用已有 Java，缺少时下载并校验官方工件。实例要求的版本不代表已经安装。":category==="steamcmd"?"使用 SteamCMD 原有安装设置和节点执行器，安装后执行 Valve 首次更新。":"从 Microsoft 官方来源下载安装包，并验证 Windows 数字签名；下载完成后仍需在目标设备运行安装器。"}</Typography.Paragraph></div>
        <div className={`runtime-manager__cards${category==="java"?" runtime-manager__cards--java":""}`}>
          {category==="java"?majors.map(value=>{const found=java.filter(item=>item.major===value&&item.available&&online),managed=found.find(item=>item.managed);return <article className="runtime-manager__card" key={value}>
            <div className="runtime-manager__card-title"><Typography.Title level={3}>Java {value}</Typography.Title><Tag color={found.length?"green":"default"}>{found.length?managed?"LFAA 已安装":"系统已发现":online?"未发现安装":"未确认"}</Tag></div>
            <Typography.Paragraph type="secondary">{found[0]?[found[0].vendor,found[0].version].filter(Boolean).join(" · "):device?.platform==="win32"&&device.architecture==="x64"?"Windows x64 · Eclipse Temurin JRE":"当前目标不支持托管安装"}</Typography.Paragraph>
            <p className="runtime-manager__path">{found[0]?.executablePath??"目标设备尚未验证此主版本；部署时可自动准备。"}</p>
            <div className="runtime-manager__card-actions"><Button type="primary" disabled={!enabled} onClick={()=>void operate("install",{major:value})}>{found.length?"校验并复用":"下载并安装"}</Button>{managed?<Popconfirm title={`卸载 Java ${value}？`} description="只卸载目标设备上的托管 Java，正在使用的环境会被拒绝卸载。" onConfirm={()=>void operate("remove",{runtimeId:managed.runtimeId,major:value})} okText="卸载" cancelText="取消"><Button danger disabled={!enabled}>卸载</Button></Popconfirm>:null}</div>
          </article>;}):null}
          {category==="visual-cpp"||category==="directx"?(overview?.packages??[]).filter(item=>item.type===category).map(item=>{const installed=runtimes.find(runtime=>runtime.runtimeId===item.id&&runtime.available&&online);return <article className="runtime-manager__card" key={item.id}><div className="runtime-manager__card-title"><Typography.Title level={3}>{item.name}</Typography.Title><Tag>{item.architecture}</Tag></div><p>{installed?`已检测到组件 · ${installed.version}`:online?"尚未核验，请重新检测环境":"安装状态未确认"}</p><Typography.Paragraph type="secondary">{category==="directx"?"为旧游戏补充 D3DX 等组件，不改变 Windows 自带 DirectX 版本。":"用于依赖 MSVC v14 的游戏和程序；旧版运行库按游戏要求另行核验。"}</Typography.Paragraph><Button type="primary" disabled={!enabled||device?.platform!=="win32"} onClick={()=>void operate("install",{packageId:item.id})}>下载官方安装包</Button></article>;}):null}
          {category==="steamcmd"?<article className="runtime-manager__card"><Typography.Title level={3}>Valve SteamCMD</Typography.Title><p>{steamTask?.nodeId===targetId&&steamTask.status==="succeeded"&&steamTask.result?.uninstalled===true?"SteamCMD 已完整卸载。":steamTask?.nodeId===targetId&&steamTask.status==="succeeded"&&steamTask.result?.verified===true&&online?"节点已通过真实版本输出校验，可供 Steam 游戏服务复用。":steamInstalled?"已发现 SteamCMD 文件，尚需执行真实版本校验。":"尚未确认可用，可从 Valve 官方 CDN 下载安装。"}</p>{steamTargetSettings?<p className="runtime-manager__path">工具目录：{steamTargetSettings.configuration.steamcmdDirectory}　·　{steamTargetSettings.configuration.installMode==="online"?"在线安装":"手动指定"}</p>:null}<div className="runtime-manager__steamcmd-actions"><Button type="primary" aria-label="从 Valve 官方下载并安装 SteamCMD" title="从 Valve 官方下载并安装 SteamCMD" icon={<WorkbenchIcon name="archive" size={16}/>} disabled={!enabled||!steamNode||steamTargetSettings?.configuration.installMode==="manual"||steamBusy||steamTaskActive} onClick={()=>void steamAction("install")}><span className="runtime-manager__steamcmd-label">官方下载并安装</span></Button><Button aria-label="校验 SteamCMD 环境" title="校验 SteamCMD 环境" icon={<WorkbenchIcon name="check" size={16}/>} disabled={!enabled||!steamNode||steamBusy||steamTaskActive} onClick={()=>void steamAction("verify")}><span className="runtime-manager__steamcmd-label">真实校验</span></Button><Button danger aria-label="完整卸载 SteamCMD 工具目录" title="完整卸载 SteamCMD 工具目录" icon={<WorkbenchIcon name="trash" size={16}/>} disabled={!enabled||!steamNode||steamBusy||steamTaskActive} onClick={()=>void steamAction("uninstall")}><span className="runtime-manager__steamcmd-label">完整卸载</span></Button><Button aria-label="在文件管理中查看 SteamCMD 目录" title="在文件管理中查看 SteamCMD 目录" icon={<WorkbenchIcon name="folder" size={16}/>} disabled={!steamNode||!steamTargetSettings?.capabilities.includes("node-filesystem-game-storage-v1")} onClick={()=>onManageSteamcmd(targetId)}><span className="runtime-manager__steamcmd-label">文件管理</span></Button><Button aria-label="打开 SteamCMD 设置与服务器管理" title="打开 SteamCMD 设置与服务器管理" icon={<WorkbenchIcon name="settings" size={16}/>} onClick={onOpenSteamcmd}><span className="runtime-manager__steamcmd-label">设置与服务器</span></Button></div>{targetId==="local"?<p>当前选中的是本机控制端；SteamCMD 必须安装到在线 Windows x64 Daemon 节点。选择上方执行设备后再操作。</p>:!steamNode?<p>SteamCMD 仅支持 Windows x64 Daemon 节点。请选择兼容的执行设备。</p>:!online?<p>所选 Daemon 当前离线；连接后才能安装、校验、卸载或浏览文件。</p>:steamTargetSettings?.configuration.installMode==="manual"?<p>当前为手动指定模式；可校验和查看已有文件。切换到在线安装后才能从 Valve 官方 CDN 下载。</p>:null}{steamTask?.nodeId===targetId?<p role="status">{steamTask.message} · {({queued:"等待中",running:"执行中",succeeded:"已完成",failed:"失败"})[steamTask.status]}</p>:null}</article>:null}
        </div>
        {category==="java"?<><section className="game-library__environment-controls"><div className="runtime-manager__java-version-selection"><label>选择常用 Java 版本<Select aria-label="选择常用 Java 版本" placeholder="请选择需要准备的版本" value={major??undefined} onChange={setMajor} options={commonJavaVersions.map(item=>({value:item.major,label:item.label}))}/></label><Typography.Text type="secondary">按游戏需求选择；有 LFAA 托管版本时会复用，否则从官方源下载并校验。</Typography.Text><Typography.Link href={major?`https://adoptium.net/temurin/releases/?version=${major}`:"https://adoptium.net/temurin/releases/"} target="_blank" rel="noreferrer">查看 Eclipse Temurin 官方发行页</Typography.Link><Button disabled={!enabled||!major||device?.platform!=="win32"||device?.architecture!=="x64"} onClick={()=>void operate("install",{major})}>下载并准备所选版本</Button>{enabled&&(device?.platform!=="win32"||device?.architecture!=="x64")?<Typography.Text type="secondary">官方托管安装当前支持 Windows x64；可在此设备手动登记已有 Java。</Typography.Text>:null}</div><label>已有 Java 可执行文件<Input aria-label="已有 Java 可执行文件" value={path} maxLength={2048} onChange={event=>setPath(event.target.value)} placeholder="目标设备上 java.exe 的完整路径"/></label><Button aria-label="浏览并选择本机 Java 可执行文件" disabled={!enabled||!canBrowseLocalFiles||targetId!=="local"||device?.platform!=="win32"} onClick={openJavaPicker}>浏览并选择</Button><Button disabled={!enabled||!path} onClick={()=>void operate("register",{executablePath:path})}>登记并验证路径</Button></section>
          {targetId!=="local"?<Typography.Paragraph className="runtime-manager__java-picker-hint" type="secondary">当前选择的是远端设备。请填写该设备上的完整 <code>java.exe</code> 路径；本机文件浏览器不会用于远端路径。已发现的 Java 可在下方列表中直接校验。</Typography.Paragraph>:!canBrowseLocalFiles?<Typography.Paragraph className="runtime-manager__java-picker-hint" type="secondary">浏览本机磁盘沿用文件管理权限，仅超级管理员且设置中心处于“完全访问”时可用；也可继续手动填写路径。</Typography.Paragraph>:device?.platform!=="win32"?<Typography.Paragraph className="runtime-manager__java-picker-hint" type="secondary">此本机目标当前不是 Windows，无法选择 <code>java.exe</code>。</Typography.Paragraph>:null}
          <Modal className="runtime-manager__java-picker" title="选择本机 Java 可执行文件" open={javaPickerOpen} onCancel={closeJavaPicker} footer={<Button onClick={closeJavaPicker}>取消</Button>} width={560} destroyOnClose>
            <div className="runtime-manager__java-picker-toolbar"><Button disabled={!javaPickerParent||javaPickerLoading} onClick={()=>void browseJavaDirectory(javaPickerParent)}>上一级</Button><Typography.Text className="runtime-manager__java-picker-location">{localPathLabel(javaPickerPath)}</Typography.Text></div>
            {javaPickerError?<Alert type="error" showIcon message={javaPickerError}/>:null}
            {javaPickerTruncated?<Alert type="info" showIcon message="此目录条目较多，仅显示前 500 项；可继续进入子目录查找。"/>:null}
            {javaPickerLoading?<div className="runtime-manager__java-picker-loading"><Spin/><span>正在读取当前目录…</span></div>:javaPickerDirectories.length||javaPickerFiles.length?<div className="runtime-manager__java-picker-list">
              {javaPickerDirectories.map(entry=><Button key={entry.path} className="runtime-manager__java-picker-entry" type="text" icon={<WorkbenchIcon name="folder" size={16}/>} onClick={()=>void browseJavaDirectory(entry.path)}><span>{entry.name}</span></Button>)}
              {javaPickerFiles.map(entry=><Button key={entry.path} className="runtime-manager__java-picker-entry runtime-manager__java-picker-entry--file" type="primary" icon={<WorkbenchIcon name="file" size={16}/>} onClick={()=>selectJavaExecutable(entry)}><span>{entry.name}<small>{localWindowsPath(entry.path)}</small></span></Button>)}
            </div>:!javaPickerError?<Empty description="此目录没有可进入的文件夹或 java.exe"/>:null}
          </Modal>
          <div className="runtime-manager__detected"><Typography.Title level={3}>此设备已发现的 Java</Typography.Title>{java.length?java.map(item=><article className="game-library__runtime" key={item.runtimeId}><div><strong>Java {item.major} · {item.version??item.vendor}</strong> <Tag>{item.managed?"LFAA 管理":item.source==="custom"?"手动登记":"系统发现"}</Tag><p className="runtime-manager__path">{item.executablePath}</p><p>{online&&item.available?"已通过实际版本检测":"历史记录，当前可用性未确认"}</p></div><div className="game-library__actions"><Button disabled={!enabled} onClick={()=>void operate("verify",{runtimeId:item.runtimeId})}>校验</Button>{item.managed?<Button disabled={!enabled} onClick={()=>void operate("update",{runtimeId:item.runtimeId,major:item.major})}>更新</Button>:null}{item.source==="custom"?<Button disabled={!enabled} onClick={()=>void operate("forget",{runtimeId:item.runtimeId})}>移除登记</Button>:null}</div></article>):<p>尚未发现可执行的 Java。可以检测、安装或登记已有路径。</p>}</div>
        </>:null}
      </div>
    </section>
    {device?.servers?.length?<section className="runtime-manager__detected" aria-label="此设备的 Minecraft 实例"><Typography.Title level={3}>对应服务器</Typography.Title>{device.servers.map(server=><article className="game-library__runtime" key={server.id}><div><strong>{server.name}</strong><p>配置要求 {server.requiredJavaMajor?`Java ${server.requiredJavaMajor}`:"官方 PHP"}；安装状态与运行状态分别核对。</p></div><Button onClick={()=>onNavigate(`/games/minecraft/instance/${server.id}/overview`)}>打开服务器</Button></article>)}</section>:null}
  </>;
}

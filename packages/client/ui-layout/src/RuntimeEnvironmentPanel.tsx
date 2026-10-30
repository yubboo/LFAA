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
type RuntimeDevice=RuntimeOverview["devices"][number];
type JavaRuntime=RuntimeDevice["runtimes"][number];
type JavaFilter="all"|"required"|"installed"|"missing";
type JavaSort="major-asc"|"major-desc"|"required-first";
type JavaDetail="version"|"servers"|"install";
function RuntimeJavaWorkspace({java,majors,device,targetId,online,enabled,canBrowseLocalFiles,installMajor,setInstallMajor,path,setPath,onBrowse,operate,onNavigate}:{
  java:JavaRuntime[];majors:number[];device:RuntimeDevice|undefined;targetId:string;online:boolean;enabled:boolean;canBrowseLocalFiles:boolean;
  installMajor:number|null;setInstallMajor:(major:number)=>void;path:string;setPath:(path:string)=>void;onBrowse:()=>void;
  operate:(operation:string,values?:Record<string,unknown>)=>Promise<void>;onNavigate:(path:string)=>void;
}) {
  const [filter,setFilter]=useState<JavaFilter>("all"),[query,setQuery]=useState(""),[sort,setSort]=useState<JavaSort>("major-asc"),[selectedMajor,setSelectedMajor]=useState<number|null>(null),[detail,setDetail]=useState<JavaDetail>("version");
  const requiredMajors=new Set((device?.servers??[]).map(server=>server.requiredJavaMajor).filter((value):value is number=>typeof value==="number"));
  const installedMajors=new Set(java.filter(item=>online&&item.available&&typeof item.major==="number").map(item=>item.major as number));
  const filterOptions:[JavaFilter,string,number][]=[
    ["all","全部",majors.length],
    ["required","实例需求",requiredMajors.size],
    ["installed","已安装",installedMajors.size],
    ["missing",online?"未发现":"未确认",majors.filter(value=>!installedMajors.has(value)).length],
  ];
  const searchText=query.trim().toLocaleLowerCase("zh-CN");
  const visibleMajors=majors.filter(value=>{
    if(filter==="required"&&!requiredMajors.has(value))return false;
    if(filter==="installed"&&!installedMajors.has(value))return false;
    if(filter==="missing"&&installedMajors.has(value))return false;
    if(!searchText)return true;
    const matches=java.filter(item=>item.major===value).map(item=>[item.vendor,item.version,item.executablePath].filter(Boolean).join(" ")).join(" ");
    const label=commonJavaVersions.find(item=>item.major===value)?.label??"";
    return `java ${value} ${label} ${matches}`.toLocaleLowerCase("zh-CN").includes(searchText);
  }).sort((a,b)=>sort==="major-desc"?b-a:sort==="required-first"?Number(requiredMajors.has(b))-Number(requiredMajors.has(a))||a-b:a-b);
  const preferredMajor=visibleMajors.find(value=>requiredMajors.has(value))??visibleMajors.find(value=>installedMajors.has(value))??visibleMajors[0]??null;
  const activeMajor=selectedMajor!==null&&visibleMajors.includes(selectedMajor)?selectedMajor:preferredMajor;
  const selectedRuntimes=activeMajor===null?[]:java.filter(item=>item.major===activeMajor);
  const availableRuntimes=selectedRuntimes.filter(item=>online&&item.available);
  const canInstallSelected=activeMajor!==null&&commonJavaVersions.some(item=>item.major===activeMajor)&&device?.platform==="win32"&&device.architecture==="x64";
  const installSelected=()=>{if(activeMajor!==null){setInstallMajor(activeMajor);setDetail("install");}};
  const installSupported=device?.platform==="win32"&&device.architecture==="x64";
  const detailTabs:[JavaDetail,string][]=[["version","版本详情"],["servers","关联实例"],["install","安装与登记"]];

  return <section className="runtime-manager__java" aria-label="Java 环境管理">
    <header className="runtime-manager__java-hero lfaa-card-motion">
      <div className="runtime-manager__java-hero-copy"><span className="runtime-manager__java-hero-icon"><EnvironmentIcon category="java"/></span><div><Typography.Title level={2}>Java 环境管理</Typography.Title><Typography.Paragraph>按设备管理版本；实例要求与已安装状态分别显示。</Typography.Paragraph><div className="runtime-manager__java-summary"><span>{online?`${installedMajors.size} 个主版本已验证`:`${java.length} 条历史记录`}</span><span>{device?.servers?.length??0} 个关联实例</span></div></div></div>
      <Button type="primary" onClick={installSelected}><WorkbenchIcon name="plus" size={16}/><span>安装或登记</span></Button>
    </header>

    <div className="runtime-manager__java-toolbar">
      <div className="runtime-manager__java-filters" role="group" aria-label="筛选 Java 版本">
        {filterOptions.map(([value,label,count])=><button type="button" key={value} aria-pressed={filter===value} disabled={count===0} onClick={()=>setFilter(value)}><span>{label}</span><small>{count}</small></button>)}
      </div>
      <Input.Search aria-label="搜索 Java 版本、厂商或路径" placeholder="搜索版本、厂商或路径" allowClear value={query} onChange={event=>setQuery(event.target.value)}/>
      <Select aria-label="Java 版本排序" value={sort} onChange={value=>setSort(value as JavaSort)} options={[{value:"major-asc",label:"版本升序"},{value:"major-desc",label:"版本降序"},{value:"required-first",label:"实例需求优先"}]}/>
    </div>

    <div className="runtime-manager__java-layout">
      <section className="runtime-manager__java-catalog" aria-label="Java 主版本列表">
        <header className="runtime-manager__java-section-heading"><div><Typography.Title level={3}>Java 版本</Typography.Title><Typography.Text type="secondary">{visibleMajors.length} / {majors.length}</Typography.Text></div></header>
        {visibleMajors.length?<div className="runtime-manager__java-version-list lfaa-card-motion-list">{visibleMajors.map(value=>{
          const entries=java.filter(item=>item.major===value),first=entries[0],installed=installedMajors.has(value),requiredCount=(device?.servers??[]).filter(server=>server.requiredJavaMajor===value).length;
          const status=!online?"待确认":installed?(entries.some(item=>item.managed&&item.available)?"LFAA 托管":"已安装"):"未发现";
          return <button type="button" key={value} className={`runtime-manager__java-version-card lfaa-card-motion${activeMajor===value?" is-selected":""}`} aria-pressed={activeMajor===value} onClick={()=>setSelectedMajor(value)}>
            <span className="runtime-manager__java-version-icon"><EnvironmentIcon category="java"/></span>
            <span className="runtime-manager__java-version-main"><span className="runtime-manager__java-version-title"><strong>Java {value}</strong><Tag color={installed?"green":"default"}>{status}</Tag></span><span className="runtime-manager__java-version-meta">{first?[first.vendor,first.version].filter(Boolean).join(" · "):online?"尚未检测到此版本":"设备离线，状态未确认"}</span>{requiredCount?<span className="runtime-manager__java-requirement">{requiredCount} 个实例需要此版本</span>:null}</span>
          </button>;
        })}</div>:<Empty description="没有符合条件的 Java 版本"/>}
      </section>

      <section className="runtime-manager__java-detail" aria-label="选中 Java 版本详情">
        {activeMajor===null?<Empty description="选择一个 Java 版本查看详情"/>:<>
          <header className="runtime-manager__java-detail-heading"><div><Typography.Text type="secondary">{device?.displayName??"未选择设备"}</Typography.Text><Typography.Title level={3}>Java {activeMajor}</Typography.Title></div><Tag color={!online?"default":availableRuntimes.length?"green":"default"}>{!online?"状态待确认":availableRuntimes.length?`${availableRuntimes.length} 个可用记录`:"尚未检测到"}</Tag></header>
          <nav className="runtime-manager__java-detail-tabs" aria-label="Java 版本信息"><div role="group">{detailTabs.map(([value,label])=><button type="button" key={value} aria-pressed={detail===value} onClick={()=>setDetail(value)}>{label}</button>)}</div></nav>

          {detail==="version"?<div className="runtime-manager__java-pane">
            {selectedRuntimes.length?selectedRuntimes.map(item=><article className="runtime-manager__java-runtime lfaa-card-motion" key={item.runtimeId}>
              <header><div><strong>{[item.vendor,item.version].filter(Boolean).join(" · ")}</strong><span>{item.managed?"LFAA 托管":item.source==="custom"?"手动登记":"系统发现"}</span></div><Tag color={online&&item.available?"green":"default"}>{!online?"历史记录":item.available?"可用":"不可用"}</Tag></header>
              {item.executablePath?<code>{item.executablePath}</code>:null}
              <div className="runtime-manager__java-runtime-actions"><Button disabled={!enabled} onClick={()=>void operate("verify",{runtimeId:item.runtimeId})}>校验</Button>{item.managed?<Button disabled={!enabled} onClick={()=>void operate("update",{runtimeId:item.runtimeId,major:item.major})}>更新</Button>:null}{item.managed?<Popconfirm title={`卸载 Java ${activeMajor}？`} description="只卸载 LFAA 托管的 Java；被实例占用时 Runtime Manager 会拒绝卸载。" onConfirm={()=>void operate("remove",{runtimeId:item.runtimeId,major:activeMajor})} okText="卸载" cancelText="取消"><Button danger disabled={!enabled}>卸载</Button></Popconfirm>:null}{item.source==="custom"?<Button danger disabled={!enabled} onClick={()=>void operate("forget",{runtimeId:item.runtimeId})}>移除登记</Button>:null}{canInstallSelected&&item.runtimeId===availableRuntimes[0]?.runtimeId?<Button className="runtime-manager__java-runtime-reuse" type="primary" disabled={!enabled} onClick={()=>void operate("install",{major:activeMajor})}>校验并复用</Button>:null}</div>
            </article>):<div className="runtime-manager__java-empty"><Empty description={online?`设备上尚未检测到 Java ${activeMajor}`:"设备离线，无法确认 Java 可用性"}/></div>}
            {canInstallSelected&&!availableRuntimes.length?<div className="runtime-manager__java-primary-action"><Button type="primary" disabled={!enabled} onClick={()=>void operate("install",{major:activeMajor})}>下载并安装 Java {activeMajor}</Button></div>:null}
          </div>:null}

          {detail==="servers"?<div className="runtime-manager__java-pane">{device?.servers?.length?<div className="runtime-manager__java-server-list">{device.servers.map(server=><article className="runtime-manager__java-server" key={server.id}><div><strong>{server.name}</strong><p>{server.requiredJavaMajor?`配置要求 Java ${server.requiredJavaMajor}`:"未指定 Java 主版本"}</p></div><div className="runtime-manager__java-server-actions">{server.requiredJavaMajor===activeMajor?<Tag color="green">需要此版本</Tag>:null}<Button onClick={()=>onNavigate(`/games/minecraft/instance/${server.id}/overview`)}>打开实例</Button></div></article>)}</div>:<Empty description="当前设备没有关联的 Minecraft 实例"/>}</div>:null}

          {detail==="install"?<div className="runtime-manager__java-pane"><div className="runtime-manager__java-install-grid">
            <section className="runtime-manager__java-install-card"><header><WorkbenchIcon name="archive" size={18}/><Typography.Title level={4}>准备托管版本</Typography.Title></header><label>常用 Java 版本<Select aria-label="选择常用 Java 版本" placeholder="选择需要准备的版本" value={installMajor??undefined} onChange={setInstallMajor} options={commonJavaVersions.map(item=>({value:item.major,label:item.label}))}/></label><Typography.Link href={installMajor?`https://adoptium.net/temurin/releases/?version=${installMajor}`:"https://adoptium.net/temurin/releases/"} target="_blank" rel="noreferrer">Eclipse Temurin 官方发行页</Typography.Link><Button type="primary" disabled={!enabled||!installMajor||!installSupported} onClick={()=>installMajor?void operate("install",{major:installMajor}):undefined}>下载并校验</Button>{enabled&&!installSupported?<Typography.Text type="secondary">托管安装当前支持 Windows x64。</Typography.Text>:null}</section>
            <section className="runtime-manager__java-install-card"><header><WorkbenchIcon name="folder" size={18}/><Typography.Title level={4}>登记已有版本</Typography.Title></header><label>目标设备上的 java.exe<Input aria-label="已有 Java 可执行文件" value={path} maxLength={2048} onChange={event=>setPath(event.target.value)} placeholder="输入 java.exe 完整路径"/></label><div className="runtime-manager__java-register-actions"><Button disabled={!enabled||!canBrowseLocalFiles||targetId!=="local"||device?.platform!=="win32"} onClick={onBrowse}>浏览本机</Button><Button type="primary" disabled={!enabled||!path} onClick={()=>void operate("register",{executablePath:path})}>登记并验证</Button></div><Typography.Text type="secondary">{targetId!=="local"?"远端路径必须属于所选设备。":canBrowseLocalFiles?"本机浏览受设置中心文件权限控制。":"本机浏览不可用，可手动填写路径。"}</Typography.Text></section>
          </div></div>:null}
        </>}
      </section>
    </div>
  </section>;
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
  const java=runtimes.filter(item=>item.type==="java"),majors=[...new Set([...commonJavaVersions.map(item=>item.major),...java.map(item=>item.major!).filter(Boolean),...(device?.servers??[]).map(server=>server.requiredJavaMajor).filter((value):value is number=>typeof value==="number")])].sort((a,b)=>a-b);
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
  useEffect(()=>{if(!steamTask||!["queued","running"].includes(steamTask.status))return;let active=true;const controller=new AbortController();const poller=createReadPoller(async()=>{try{const value=await loadSteamcmdTask(steamTask.id,controller.signal);if(active)setSteamTask(value.task);if(!["queued","running"].includes(value.task.status))poller.stop();}catch(reason){if(active)setError(getErrorMessage(reason));}},3000);return()=>{active=false;controller.abort();poller.stop();};},[steamTask?.id]);
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
    </section>
    {error?<Alert type="error" showIcon message={error}/>:null}
    {!online&&device?<Alert type="warning" showIcon message="设备离线，以下为历史记录，不能确认当前可用。"/>:null}
    <section className="runtime-manager">
      <nav className="runtime-manager__tabs" aria-label="运行环境分类">{categories.map(item=><button type="button" aria-pressed={category===item.id} key={item.id} onClick={()=>setCategory(item.id)}><EnvironmentIcon category={item.id}/>{item.title}</button>)}</nav>
      <div className="runtime-manager__body">
        {category!=="java"?<>
        <div className="runtime-manager__heading"><Typography.Title level={2}>{categories.find(item=>item.id===category)?.title}</Typography.Title><Typography.Paragraph>{category==="steamcmd"?"使用 SteamCMD 原有安装设置和节点执行器，安装后执行 Valve 首次更新。":"从 Microsoft 官方来源下载安装包，并验证 Windows 数字签名；下载完成后仍需在目标设备运行安装器。"}</Typography.Paragraph></div>
        <div className="runtime-manager__cards">
          {category==="visual-cpp"||category==="directx"?(overview?.packages??[]).filter(item=>item.type===category).map(item=>{const installed=runtimes.find(runtime=>runtime.runtimeId===item.id&&runtime.available&&online);return <article className="runtime-manager__card" key={item.id}><div className="runtime-manager__card-title"><Typography.Title level={3}>{item.name}</Typography.Title><Tag>{item.architecture}</Tag></div><p>{installed?`已检测到组件 · ${installed.version}`:online?"尚未核验，请重新检测环境":"安装状态未确认"}</p><Typography.Paragraph type="secondary">{category==="directx"?"为旧游戏补充 D3DX 等组件，不改变 Windows 自带 DirectX 版本。":"用于依赖 MSVC v14 的游戏和程序；旧版运行库按游戏要求另行核验。"}</Typography.Paragraph><Button type="primary" disabled={!enabled||device?.platform!=="win32"} onClick={()=>void operate("install",{packageId:item.id})}>下载官方安装包</Button></article>;}):null}
          {category==="steamcmd"?<article className="runtime-manager__card"><Typography.Title level={3}>Valve SteamCMD</Typography.Title><p>{steamTask?.nodeId===targetId&&steamTask.status==="succeeded"&&steamTask.result?.uninstalled===true?"SteamCMD 已完整卸载。":steamTask?.nodeId===targetId&&steamTask.status==="succeeded"&&steamTask.result?.verified===true&&online?"节点已通过真实版本输出校验，可供 Steam 游戏服务复用。":steamInstalled?"已发现 SteamCMD 文件，尚需执行真实版本校验。":"尚未确认可用，可从 Valve 官方 CDN 下载安装。"}</p>{steamTargetSettings?<p className="runtime-manager__path">工具目录：{steamTargetSettings.configuration.steamcmdDirectory}　·　{steamTargetSettings.configuration.installMode==="online"?"在线安装":"手动指定"}</p>:null}<div className="runtime-manager__steamcmd-actions"><Button type="primary" aria-label="从 Valve 官方下载并安装 SteamCMD" title="从 Valve 官方下载并安装 SteamCMD" icon={<WorkbenchIcon name="archive" size={16}/>} disabled={!enabled||!steamNode||steamTargetSettings?.configuration.installMode==="manual"||steamBusy||steamTaskActive} onClick={()=>void steamAction("install")}><span className="runtime-manager__steamcmd-label">官方下载并安装</span></Button><Button aria-label="校验 SteamCMD 环境" title="校验 SteamCMD 环境" icon={<WorkbenchIcon name="check" size={16}/>} disabled={!enabled||!steamNode||steamBusy||steamTaskActive} onClick={()=>void steamAction("verify")}><span className="runtime-manager__steamcmd-label">真实校验</span></Button><Button danger aria-label="完整卸载 SteamCMD 工具目录" title="完整卸载 SteamCMD 工具目录" icon={<WorkbenchIcon name="trash" size={16}/>} disabled={!enabled||!steamNode||steamBusy||steamTaskActive} onClick={()=>void steamAction("uninstall")}><span className="runtime-manager__steamcmd-label">完整卸载</span></Button><Button aria-label="在文件管理中查看 SteamCMD 目录" title="在文件管理中查看 SteamCMD 目录" icon={<WorkbenchIcon name="folder" size={16}/>} disabled={!steamNode||!steamTargetSettings?.capabilities.includes("node-filesystem-game-storage-v1")} onClick={()=>onManageSteamcmd(targetId)}><span className="runtime-manager__steamcmd-label">文件管理</span></Button><Button aria-label="打开 SteamCMD 设置与服务器管理" title="打开 SteamCMD 设置与服务器管理" icon={<WorkbenchIcon name="settings" size={16}/>} onClick={onOpenSteamcmd}><span className="runtime-manager__steamcmd-label">设置与服务器</span></Button></div>{targetId==="local"?<p>当前选中的是本机控制端；SteamCMD 必须安装到在线 Windows x64 Daemon 节点。选择上方执行设备后再操作。</p>:!steamNode?<p>SteamCMD 仅支持 Windows x64 Daemon 节点。请选择兼容的执行设备。</p>:!online?<p>所选 Daemon 当前离线；连接后才能安装、校验、卸载或浏览文件。</p>:steamTargetSettings?.configuration.installMode==="manual"?<p>当前为手动指定模式；可校验和查看已有文件。切换到在线安装后才能从 Valve 官方 CDN 下载。</p>:null}{steamTask?.nodeId===targetId?<p role="status">{steamTask.message} · {({queued:"等待中",running:"执行中",succeeded:"已完成",failed:"失败"})[steamTask.status]}</p>:null}</article>:null}
        </div>
        </>:null}
        {category==="java"?<><RuntimeJavaWorkspace java={java} majors={majors} device={device} targetId={targetId} online={online} enabled={enabled} canBrowseLocalFiles={canBrowseLocalFiles} installMajor={major} setInstallMajor={setMajor} path={path} setPath={setPath} onBrowse={openJavaPicker} operate={operate} onNavigate={onNavigate}/>
          <Modal className="runtime-manager__java-picker" title="选择本机 Java 可执行文件" open={javaPickerOpen} onCancel={closeJavaPicker} footer={<Button onClick={closeJavaPicker}>取消</Button>} width={560} destroyOnClose>
            <div className="runtime-manager__java-picker-toolbar"><Button disabled={!javaPickerParent||javaPickerLoading} onClick={()=>void browseJavaDirectory(javaPickerParent)}>上一级</Button><Typography.Text className="runtime-manager__java-picker-location">{localPathLabel(javaPickerPath)}</Typography.Text></div>
            {javaPickerError?<Alert type="error" showIcon message={javaPickerError}/>:null}
            {javaPickerTruncated?<Alert type="info" showIcon message="此目录条目较多，仅显示前 500 项；可继续进入子目录查找。"/>:null}
            {javaPickerLoading?<div className="runtime-manager__java-picker-loading"><Spin/><span>正在读取当前目录…</span></div>:javaPickerDirectories.length||javaPickerFiles.length?<div className="runtime-manager__java-picker-list">
              {javaPickerDirectories.map(entry=><Button key={entry.path} className="runtime-manager__java-picker-entry" type="text" icon={<WorkbenchIcon name="folder" size={16}/>} onClick={()=>void browseJavaDirectory(entry.path)}><span>{entry.name}</span></Button>)}
              {javaPickerFiles.map(entry=><Button key={entry.path} className="runtime-manager__java-picker-entry runtime-manager__java-picker-entry--file" type="primary" icon={<WorkbenchIcon name="file" size={16}/>} onClick={()=>selectJavaExecutable(entry)}><span>{entry.name}<small>{localWindowsPath(entry.path)}</small></span></Button>)}
            </div>:!javaPickerError?<Empty description="此目录没有可进入的文件夹或 java.exe"/>:null}
          </Modal>
        </>:null}
      </div>
    </section>
    {category!=="java"&&device?.servers?.length?<section className="runtime-manager__detected" aria-label="此设备的 Minecraft 实例"><Typography.Title level={3}>对应服务器</Typography.Title>{device.servers.map(server=><article className="game-library__runtime" key={server.id}><div><strong>{server.name}</strong><p>配置要求 {server.requiredJavaMajor?`Java ${server.requiredJavaMajor}`:"未指定 Java 主版本"}；安装状态与运行状态分别核对。</p></div><Button onClick={()=>onNavigate(`/games/minecraft/instance/${server.id}/overview`)}>打开服务器</Button></article>)}</section>:null}
  </>;
}

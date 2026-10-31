/**
 * 功能：展示多核心资源库式选型和传统面板自动开服表单。
 * 作用：读取真实分类、核心、版本及自动匹配的下载工件，消费设置默认值并一次提交节点安装/配置/启动任务。
 * 关联文件：MinecraftWorkspace.tsx 提供节点与任务状态；connection/api.ts 提供目录与部署 API；MinecraftWorkspace.css 提供共享主题样式。
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {createSnapshotCache} from "lfaa-client-store/src/snapshot-cache.js";
import {loadMinecraftRuntimeRequirement} from "lfaa-client-connection/src/runtime-api.js";
import { Alert, Button, Card, Checkbox, Input, InputNumber, Select, Space, Tag, Typography } from "antd";
import { getErrorMessage, loadMinecraftCores, loadMinecraftCoreBuilds, provisionMinecraftServer, type MinecraftCore, type MinecraftNode, type MinecraftInstance, type UserSettings } from "lfaa-client-connection/src/api.js";

interface Props {
  userId:string;
  onPrepareWithAi:(prompt:string)=>void;
  nodes: MinecraftNode[]; instances: MinecraftInstance[]; settings: UserSettings; canOperate: boolean;
  onSubmit: (operation: () => Promise<unknown>, feedback?: { message: string; showTasksLink: boolean }) => Promise<boolean>;
  onNavigate: (path: string) => void;
}
const categoryNames = { pure: "纯净与插件", mod: "模组与混合", vanilla: "原版", proxy: "代理", bedrock: "基岩" };
const categoryDescriptions: Record<MinecraftCore["category"], string> = {
  pure: "原版增强与插件生态", mod: "模组及混合核心", vanilla: "Minecraft 官方原版", proxy: "连接 Java 后端实例", bedrock: "基岩版运行核心"
};
const coreDescriptions: Record<string, string> = {
  Paper: "推荐给普通生存与 Bukkit/Spigot 插件服。",
  Vanilla: "保持 Mojang 原版行为；不支持 Bukkit 插件或 Forge/Fabric 模组。",
  Fabric: "适合 Fabric 模组包；客户端模组与服务器版本需要按模组包要求一致。",
  Forge: "适合 Forge 模组包；自动运行安装器并准备服务端依赖。",
  Folia: "仅选明确支持 Folia 的插件；Paper 插件未必兼容。",
  Purpur: "Paper 分支，提供更多玩法配置。",
  Leaves: "偏原版机制；部署前确认插件兼容。",
  Arclight: "模组与插件混合核心，所选版本后缀决定 Forge、NeoForge 或 Fabric 加载器。",
  CatServer: "模组与插件混合核心；模组、插件和核心版本必须相互兼容。",
  Youer: "NeoForge 与 Paper/Purpur 混合核心；从 Mohist 官网拉取对应版本程序包。",
  SpongeForge: "Forge + Sponge 插件；自动安装匹配的 Forge 加载器。",
  SpongeNeo: "NeoForge + Sponge 插件；自动安装匹配的 NeoForge 加载器。",
  SpongeVanilla: "搭配 Sponge 插件；不兼容 Bukkit 插件。",
  Velocity: "连接多个 Java 后端的代理。请先准备同节点真实后端实例，不会自动关闭后端正版验证。",
  BungeeCord: "连接 Java 后端的代理。先选择已运行且配置适合代理的后端实例。",
  Nukkit: "Java 编写的基岩服务器，适合基岩玩家和 Nukkit 插件。",
  PocketMine: "PHP 编写的基岩服务器；自动准备 PocketMine 官方 PHP，功能与原版基岩服有差异。"
};
/** 优先显示真实稳定版；版本值仍来自上游，排序不决定支持能力。 */
function orderedVersions(versions: string[]): string[] {
  return [...versions].sort((a, b) => {
    const stable = (v: string) => /^\d+(?:\.\d+)*(?:-(?:forge|neoforge|fabric))?$/u.test(v);
    return Number(stable(b)) - Number(stable(a)) || b.localeCompare(a, undefined, { numeric: true });
  });
}
interface DeploymentDraft {core:string;version:string;nodeId:string;name:string;backendId:string;memory:number|null;port:number|null;step:number;javaRuntimeId:string;}
const draftCache=createSnapshotCache<DeploymentDraft>();
// 核心目录只缓存本次运行中至少返回一个可用核心的快照；显式刷新才重新读取上游。
const coreCatalogCache=createSnapshotCache<Awaited<ReturnType<typeof loadMinecraftCores>>>();
const coreBuildCache=createSnapshotCache<Awaited<ReturnType<typeof loadMinecraftCoreBuilds>>>();
// 核心目录上游请求最多等待 20 秒；额外留 5 秒给控制面返回，并保证界面能恢复重试。
const CORE_CATALOG_REQUEST_TIMEOUT_MS = 25_000;
export function MinecraftDeploymentPanel({ userId,onPrepareWithAi,nodes, instances, settings, canOperate, onSubmit, onNavigate }: Props) {
  const draft=useRef(draftCache.get(userId)).current;
  const [coreCatalogEntry,setCoreCatalogEntry]=useState(()=>({userId,value:coreCatalogCache.get(userId)??null}));
  const catalogMatchesUser=coreCatalogEntry.userId===userId;
  const cachedCoreCatalog=catalogMatchesUser?coreCatalogEntry.value:null;
  const cores=cachedCoreCatalog?.cores??[], sourceErrors=cachedCoreCatalog?.errors??[];
  const [catalogLoading,setCatalogLoading]=useState(()=>!coreCatalogCache.get(userId)?.cores.length);
  const [reloadState,setReloadState]=useState({userId,revision:0});
  const reload=reloadState.userId===userId?reloadState.revision:0;
  const catalogLoadingForUser=catalogLoading||!catalogMatchesUser;
  const [core, setCore] = useState(draft?.core??settings.minecraftRuntime.minecraftDefaultCore), [version, setVersion] = useState(draft?.version??""), [build, setBuild] = useState("");
  const [category, setCategory] = useState<MinecraftCore["category"] | "">(""), [coreSearch, setCoreSearch] = useState(""), [visibleVersionCount, setVisibleVersionCount] = useState(24);
  const [packageAvailable, setPackageAvailable] = useState(false), [buildLoading, setBuildLoading] = useState(false);
  const [nodeId, setNodeId] = useState(draft?.nodeId??""), [name, setName] = useState(draft?.name??""), [backendId, setBackendId] = useState(draft?.backendId??"");
  const [javaRuntimeId,setJavaRuntimeId]=useState(draft?.javaRuntimeId??"");
  const [requirementRetry,setRequirementRetry]=useState(0);
  const [requirementEntry,setRequirementEntry]=useState<{key:string;value:Awaited<ReturnType<typeof loadMinecraftRuntimeRequirement>>}|null>(null);
  const [requirementErrorEntry,setRequirementErrorEntry]=useState<{key:string;message:string}|null>(null);
  const [memory, setMemory] = useState<number | null>(draft?.memory??settings.minecraftRuntime.minecraftDefaultMemoryMb);
  const [port, setPort] = useState<number | null>(draft?.port??settings.minecraftRuntime.minecraftDefaultPort);
  const [eula, setEula] = useState(false), [submitting, setSubmitting] = useState(false), [error, setError] = useState("");
  const [step, setStep] = useState(draft?.step??0);
  const requirementKey=`${core}\u001f${version}\u001f${build}\u001f${nodeId}\u001f${requirementRetry}`;
  const requirement=requirementEntry?.key===requirementKey?requirementEntry.value:null;
  const requirementError=requirementErrorEntry?.key===requirementKey?requirementErrorEntry.message:"";
  const shouldCheckRequirement=step>=1&&Boolean(nodeId&&version&&build&&canOperate);
  const requirementLoading=shouldCheckRequirement&&!requirement&&!requirementError;
  const refreshBuildKey=useRef<string|null>(null);
  useEffect(()=>{draftCache.set(userId,{core,version,nodeId,name,backendId,memory,port,step,javaRuntimeId});},[userId,core,version,nodeId,name,backendId,memory,port,step,javaRuntimeId]);
  useEffect(()=>{
    if(!shouldCheckRequirement)return;
    const key=requirementKey;
    let active=true;
    const controller=new AbortController();
    setRequirementEntry(null);
    setRequirementErrorEntry(null);
    void loadMinecraftRuntimeRequirement({core,version,build,nodeId},controller.signal)
      .then(value=>{if(active&&!controller.signal.aborted)setRequirementEntry({key,value});})
      .catch(reason=>{if(active&&!controller.signal.aborted)setRequirementErrorEntry({key,message:getErrorMessage(reason)});});
    return()=>{active=false;controller.abort();};
  },[core,version,build,nodeId,canOperate,shouldCheckRequirement,requirementRetry]);
  const buildSequence = useRef(0);
  const selectedCore = cores.find(c => c.name === core);
  const versions = useMemo(() => orderedVersions(selectedCore?.versions ?? []), [selectedCore]);
  const coreCategories = useMemo(() => Object.entries(categoryNames).map(([value, label]) => ({
    value: value as MinecraftCore["category"], label, count: cores.filter(item => item.category === value).length
  })).filter(item => item.count > 0), [cores]);
  const categoryCores = useMemo(() => cores.filter(item => item.category === category), [cores, category]);
  const visibleCores = useMemo(() => {
    const query = coreSearch.trim().toLocaleLowerCase();
    return query ? categoryCores.filter(item => item.name.toLocaleLowerCase().includes(query)) : categoryCores;
  }, [categoryCores, coreSearch]);
  const activeCore = selectedCore?.category === category ? selectedCore : undefined;
  const visibleVersions = versions.slice(0, visibleVersionCount);
  const eligible = nodes.filter(n => n.status === "online" && n.platform === "win32" && n.architecture === "x64" && n.capabilities.includes("minecraft-multicore-v1"));
  const selectedNode = eligible.find(n => n.id === nodeId);
  const runtimeRequirementReady=selectedCore?.launchKind==="php"||Boolean(requirement);
  const canHandOffRuntime=Boolean(selectedNode&&activeCore&&version&&build&&!buildLoading&&(requirement||requirementError));
  const runtimePreparationPrompt=requirement
    ? `请为当前手动部署草稿准备运行环境。核心 ${core}，游戏版本 ${version}，构建 ${build}，实例名称 ${name.trim()||"待填写"}；目标节点 ${selectedNode?.displayName??nodeId}（${nodeId}）。核心元数据已核实需要 Java ${requirement.javaMajor}（来源 ${requirement.source}），优先复用该节点已有兼容环境，缺少时按该节点的项目与存储设置准备。不要提交服务器部署。`
    : `请为当前手动部署草稿核查并准备运行环境。核心 ${core}，游戏版本 ${version}，构建 ${build}，实例名称 ${name.trim()||"待填写"}；目标节点 ${selectedNode?.displayName??nodeId}（${nodeId}）。部署页面核验 Java 要求失败：${requirementError}。请依据已接入的核心工件与节点运行环境能力取得真实要求并检查该节点；仍无法核实则报告真实错误并停止，不得猜测 Java 版本或提交服务器部署。`;
  const backends = instances.filter(i => i.nodeId === nodeId && i.state === "running" && i.serverProperties.onlineMode === false && i.serverProperties.serverPort && !["BungeeCord", "Velocity", "Nukkit", "PocketMine"].includes(i.coreType));
  const modeNative = settings.minecraftRuntime.minecraftExecutionMode === "native";
  const previousDefaults = useRef(settings.minecraftRuntime);
  useEffect(() => {
    if (!coreCategories.length) {
      if (category) setCategory("");
      return;
    }
    if (!coreCategories.some(item => item.value === category)) setCategory(selectedCore?.category ?? coreCategories[0]!.value);
  }, [category, coreCategories, selectedCore]);
  useEffect(() => {
    if (selectedCore && core === settings.minecraftRuntime.minecraftDefaultCore) setCategory(selectedCore.category);
  }, [core, selectedCore, settings.minecraftRuntime.minecraftDefaultCore]);
  useEffect(() => {
    const previous = previousDefaults.current;
    setMemory(value => value === previous.minecraftDefaultMemoryMb ? settings.minecraftRuntime.minecraftDefaultMemoryMb : value);
    setCore(value => value === previous.minecraftDefaultCore ? settings.minecraftRuntime.minecraftDefaultCore : value);
    setPort(value => value === previous.minecraftDefaultPort ? settings.minecraftRuntime.minecraftDefaultPort : value === previous.minecraftBedrockDefaultPort ? settings.minecraftRuntime.minecraftBedrockDefaultPort : value);
    previousDefaults.current = settings.minecraftRuntime;
  }, [settings.minecraftRuntime]);
  useEffect(() => {
    const cached=coreCatalogCache.get(userId);
    if(reload===0&&cached?.cores.length){setCoreCatalogEntry({userId,value:cached});setCatalogLoading(false);return;}
    let alive = true; setCatalogLoading(true);
    const controller=new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, CORE_CATALOG_REQUEST_TIMEOUT_MS);
    loadMinecraftCores(controller.signal).then(value => { if (alive) { if(value.cores.length)coreCatalogCache.set(userId,value); setCoreCatalogEntry({userId,value}); } }).catch(reason => {
      if (alive && (timedOut || !controller.signal.aborted)) {
        const message = timedOut ? "核心目录加载超时，请检查网络或服务状态后刷新。" : getErrorMessage(reason);
        setCoreCatalogEntry({userId,value:{cores:[],errors:[message]}});
      }
    }).finally(() => { window.clearTimeout(timeout); if (alive) setCatalogLoading(false); });
    return () => { alive = false; window.clearTimeout(timeout); controller.abort(); };
  }, [reload, userId]);
  useEffect(() => {
    if (catalogLoadingForUser) return;
    if (!selectedCore) {
      if (core) setCore("");
      if (version) setVersion("");
      setBuild("");
      setPackageAvailable(false);
      return;
    }
    if (versions.length) setVersion(current => versions.includes(current) ? current : versions[0] ?? "");
    else if (version) setVersion("");
  }, [catalogLoadingForUser, core, selectedCore, version, versions]);
  useEffect(() => { setVisibleVersionCount(24); }, [core]);
  useEffect(() => { setBackendId(""); }, [core]);
  const soleNodeId = eligible.length === 1 ? eligible[0]!.id : "";
  useEffect(() => { if (!nodeId && soleNodeId) setNodeId(soleNodeId); }, [nodeId, soleNodeId]);
  // 默认端口已被本节点实例登记时给出下一个建议；保留用户显式修改过的端口。
  useEffect(()=>{setPort(current=>{
    const defaultPort=selectedCore?.category==="bedrock"?settings.minecraftRuntime.minecraftBedrockDefaultPort:settings.minecraftRuntime.minecraftDefaultPort;
    if(current!==defaultPort||!nodeId)return current;
    const used=new Set(instances.filter(item=>item.nodeId===nodeId).map(item=>item.serverProperties.serverPort));
    let suggested=defaultPort;while(used.has(suggested)&&suggested<65535)suggested++;
    return suggested;
  });},[nodeId,instances,selectedCore?.category,settings.minecraftRuntime.minecraftDefaultPort,settings.minecraftRuntime.minecraftBedrockDefaultPort]);
  useEffect(() => {
    const sequence = ++buildSequence.current;
    setPackageAvailable(false); setBuild(""); setError("");
    if (catalogLoadingForUser || !selectedCore || !version) { setBuildLoading(false); return; }
    const cacheKey=`${userId}\u001f${core}\u001f${version}`;
    const cached=coreBuildCache.get(cacheKey);
    if(cached&&refreshBuildKey.current!==cacheKey){const preferredArtifact=cached.builds[0];setBuild(preferredArtifact?.id??"");setPackageAvailable(Boolean(preferredArtifact?.id));setBuildLoading(false);return()=>{buildSequence.current++;};}
    if(refreshBuildKey.current===cacheKey)refreshBuildKey.current=null;
    const controller=new AbortController();
    setBuildLoading(true);
    loadMinecraftCoreBuilds(core, version, 0, controller.signal).then(value => { if (sequence === buildSequence.current) { coreBuildCache.set(cacheKey,value); const preferredArtifact = value.builds[0]; setBuild(preferredArtifact?.id ?? ""); setPackageAvailable(Boolean(preferredArtifact?.id)); } }).catch(reason => { if (!controller.signal.aborted&&sequence === buildSequence.current) setError(getErrorMessage(reason)); }).finally(() => { if (sequence === buildSequence.current) setBuildLoading(false); });
    return () => { buildSequence.current++; controller.abort(); };
  }, [catalogLoadingForUser, core, selectedCore, version, reload, userId]);
  const changeCore = (value: string) => {
    const next = cores.find(c => c.name === value);
    if (!next) return;
    const previousBedrock = selectedCore?.category === "bedrock";
    const nextBedrock = next?.category === "bedrock";
    if (nextBedrock !== previousBedrock) setPort(nextBedrock ? settings.minecraftRuntime.minecraftBedrockDefaultPort : settings.minecraftRuntime.minecraftDefaultPort);
    setCategory(next.category);
    setCore(value);
  };
  const changeCategory = (value: MinecraftCore["category"]) => { setCategory(value); setCoreSearch(""); };
  const loadMoreVersions = () => setVisibleVersionCount(current => Math.min(current + 24, versions.length));
  const sourceReady = Boolean(activeCore && version && build && packageAvailable && !buildLoading);
  const portConflict=instances.some(item=>item.nodeId===nodeId&&item.serverProperties.serverPort===port);
  const nameConflict=instances.some(item=>item.nodeId===nodeId&&item.name.normalize("NFC").toLowerCase()===name.trim().normalize("NFC").toLowerCase());
  const runtimeValid=!javaRuntimeId||Boolean(requirement?.runtimes.some(item=>item.runtimeId===javaRuntimeId));
  const instanceReady = Boolean(selectedNode && name.trim() && !nameConflict && memory && port && !portConflict && runtimeValid && (activeCore?.category !== "proxy" || backends.some(i => i.id === backendId)));
  const nextStepReady=step===0?sourceReady:instanceReady&&runtimeRequirementReady;
  const valid = canOperate && sourceReady && instanceReady && modeNative && runtimeRequirementReady && eula;
  const moveToStep=(next:number)=>{
    if(next===1&&step!==1)setRequirementRetry(value=>value+1);
    setStep(next);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (step !== 2 || !valid || !memory || !port) return; setSubmitting(true);
    try {
      const success = await onSubmit(() => provisionMinecraftServer({ nodeId, name: name.trim(), core, version, build, eulaAccepted: true, memoryMb: memory, serverPort: port,javaRuntimeId:javaRuntimeId||null, ...(activeCore?.category === "proxy" ? { proxyBackendInstanceId: backendId } : {}) }), {
        message: "开服部署任务已提交。",
        showTasksLink: true,
      });
      if (success) {
        draftCache.set(userId,{core,version,nodeId,name:"",backendId:"",memory,port:settings.minecraftRuntime.minecraftDefaultPort,step:0,javaRuntimeId:""});
        setName(""); setEula(false); moveToStep(0);
      }
    } finally { setSubmitting(false); }
  };
  return <Card className="minecraft-card minecraft-create-card minecraft-provision-card">
    <div className="minecraft-card-heading minecraft-deployment-card-heading">
      <div>
        <Typography.Title level={4}>新建 Minecraft 服务器</Typography.Title>
        <Typography.Paragraph>选核心与版本，设置实例并核对 EULA。</Typography.Paragraph>
      </div>
      <Button onClick={() => {refreshBuildKey.current=`${userId}\u001f${core}\u001f${version}`;setReloadState(value => ({userId,revision:(value.userId===userId?value.revision:0)+1}));}} loading={catalogLoadingForUser}>刷新核心目录</Button>
    </div>
    <div className="minecraft-provision-alerts">
      {sourceErrors.map(message => <Alert key={message} type="warning" showIcon message={message} />)}
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {!eligible.length ? <Alert className="minecraft-provision-readiness-alert" type="warning" showIcon message="尚无在线的多核心执行节点" description="控制端连接正常不代表 Daemon 在线。进入控制节点启动本机服务，或连接远程执行节点。" action={<Button onClick={() => onNavigate("/apps/minecraft/normal/nodes")}>检查节点</Button>} /> : null}
      {!modeNative ? <Alert type="warning" showIcon message="当前设置选择 AppContainer" description="多核心自动安装需要推荐的本机原生执行方式。请在设置中心修改执行方式；此处不会静默回退。" /> : null}
      {core === "SpongeForge" && settings.minecraftRuntime.minecraftStopTimeoutSeconds < 90 ? <Alert type="info" showIcon message="SpongeForge 建议将安全停服等待设为 90 秒" description="本次实机中 30 秒会触发强制结束，90 秒完成正常退出。可在设置中心调整 Minecraft 停服等待时间；此处保留你的已保存设置。" /> : null}
    </div>
    <ol className="minecraft-wizard-progress" aria-label="部署步骤">
      {["选核心", "设实例", "核对开服"].map((label, index) => <li className={step === index ? "is-current" : step > index ? "is-complete" : ""} aria-label={["选择服务端", "设置实例", "核对并部署"][index]} aria-current={step === index ? "step" : undefined} key={label}>
        <span className="minecraft-wizard-progress__number">{index + 1}</span><span>{label}</span>
      </li>)}
    </ol>
    <div className="minecraft-wizard-intro" aria-live="polite">
      <Typography.Title level={5}>{["选择服务端核心和版本", "设置实例运行位置", "确认部署信息和许可"][step]}</Typography.Title>
      <Typography.Text type="secondary">{[
        "可用核心来自资源目录；下载包会在部署时校验。",
        "选择在线运行设备，设置名称、端口与内存。",
        "核对节点和参数，阅读并同意 EULA 后提交。"
      ][step]}</Typography.Text>
    </div>
    <form className="minecraft-provision-form" onSubmit={submit}>
      {step === 0 ? <section className="minecraft-core-library" aria-label="服务端核心资源库">
        <nav className="minecraft-core-categories" aria-label="服务端类型">
          <div className="minecraft-core-categories__heading">
            <div><Typography.Title level={5}>服务端类型</Typography.Title><Typography.Text type="secondary">仅列出可用类型</Typography.Text></div>
            <Tag>{catalogLoadingForUser ? "读取中" : `${coreCategories.length} 类`}</Tag>
          </div>
          <div className="minecraft-core-categories__list lfaa-card-motion-list">
            {catalogLoadingForUser && !coreCategories.length ? <Typography.Text type="secondary">正在读取核心分类…</Typography.Text> : null}
            {coreCategories.map(item => <button
              aria-current={category === item.value ? "true" : undefined}
              className="minecraft-core-category lfaa-card-motion"
              key={item.value}
              onClick={() => changeCategory(item.value)}
              type="button"
            >
              <span className="minecraft-core-category__mark" aria-hidden="true">{item.label.slice(0, 1)}</span>
              <span className="minecraft-core-category__copy"><strong>{item.label}</strong><small>{categoryDescriptions[item.value]}</small></span>
              <Tag>{item.count}</Tag>
            </button>)}
            {!catalogLoadingForUser && !coreCategories.length ? <Typography.Text type="secondary">目录暂未提供可选分类。</Typography.Text> : null}
          </div>
        </nav>
        <div className="minecraft-core-browser">
          <div className="minecraft-core-browser__heading">
            <div>
              <div className="minecraft-core-browser__title"><Typography.Title level={5}>选择具体核心分支</Typography.Title>{selectedCore ? <Tag color={activeCore ? "blue" : undefined}>{activeCore ? `已选 ${activeCore.name}` : `表单当前为 ${selectedCore?.name}`}</Tag> : null}</div>
              <Typography.Text type="secondary">选定分支后显示对应版本。</Typography.Text>
            </div>
            <Input aria-label="搜索当前分类核心" allowClear value={coreSearch} onChange={event => setCoreSearch(event.target.value)} placeholder="搜索核心名称…" />
          </div>
          <div className="minecraft-core-option-grid lfaa-card-motion-list" role="group" aria-label="核心分支">
            {catalogLoadingForUser && !cores.length ? <div className="minecraft-core-picker-empty">正在读取核心目录…</div> : null}
            {!catalogLoadingForUser && cores.length > 0 && !categoryCores.length ? <div className="minecraft-core-picker-empty">这个分类当前没有可用核心。</div> : null}
            {!catalogLoadingForUser && categoryCores.length > 0 && !visibleCores.length ? <div className="minecraft-core-picker-empty">当前分类没有匹配“{coreSearch.trim()}”的核心。</div> : null}
            {visibleCores.map(item => <button
              aria-pressed={core === item.name}
              className={`minecraft-core-option lfaa-card-motion${core === item.name ? " is-selected" : ""}`}
              key={item.name}
              onClick={() => changeCore(item.name)}
              title={coreDescriptions[item.name] ?? "请核对核心用途与所需模组/插件兼容性。"}
              type="button"
            >
              <span className="minecraft-core-option__top"><span className="minecraft-core-option__mark" aria-hidden="true">{item.name.slice(0, 1)}</span>{item.name === "Paper" ? <Tag color="blue">插件服推荐</Tag> : null}</span>
              <strong>{item.name}</strong>
              <small>{coreDescriptions[item.name] ?? "请核对核心用途与所需模组/插件兼容性。"}</small>
              <span className="minecraft-core-option__state">{core === item.name ? "当前选择" : "选择核心"}</span>
            </button>)}
          </div>
          {activeCore ? <div className="minecraft-core-description">
            <Space><Tag>{categoryNames[activeCore.category]}</Tag><Typography.Link href={activeCore.homepage} target="_blank" rel="noreferrer">核心项目说明</Typography.Link></Space>
          </div> : <div className="minecraft-core-picker-empty minecraft-core-picker-empty--hint">{selectedCore ? `当前表单保留 ${selectedCore.name}；选同类核心后可切换版本。` : "先选择核心，再查看版本。"}</div>}
          <section className="minecraft-core-version-section" aria-labelledby="minecraft-provision-version-title">
            <div className="minecraft-core-subheading">
              <div><Typography.Title id="minecraft-provision-version-title" level={5}>{activeCore ? `选择${activeCore.category === "proxy" || activeCore.category === "bedrock" ? "核心版本通道" : "Minecraft 版本"}` : "选择版本"}</Typography.Title><Typography.Text type="secondary">{activeCore ? "版本来自核心目录；部署时由目标节点下载并校验。" : "选择核心分支后显示它的实际版本。"}</Typography.Text></div>
              {activeCore ? <Tag>{versions.length} 个版本</Tag> : null}
            </div>
            {activeCore && versions.length ? <div className="minecraft-core-version-grid lfaa-card-motion-list" role="group" aria-label="可用版本">
              {visibleVersions.map(value => <button aria-pressed={version === value} className={`minecraft-core-version lfaa-card-motion${version === value ? " is-selected" : ""}`} key={value} onClick={() => setVersion(value)} type="button"><span>{value}</span></button>)}
            </div> : null}
            {activeCore && !versions.length && !catalogLoadingForUser ? <div className="minecraft-core-picker-empty">核心目录暂未返回可用版本。</div> : null}
            {!activeCore ? <div className="minecraft-core-picker-empty">先选择一个核心分支，版本列表会显示在这里。</div> : null}
            {activeCore && visibleVersionCount < versions.length ? <Button className="minecraft-provision-load-more" htmlType="button" onClick={loadMoreVersions}>加载更多版本（已显示 {visibleVersionCount}/{versions.length}）</Button> : null}
          </section>
          <section className="minecraft-core-package-section" aria-labelledby="minecraft-provision-package-title">
            <div className="minecraft-core-subheading">
              <div><Typography.Title id="minecraft-provision-package-title" level={5}>服务端下载包</Typography.Title><Typography.Text type="secondary">自动匹配，并在部署时校验来源摘要。</Typography.Text></div>
              {activeCore && version ? <Tag>{buildLoading && !packageAvailable ? "匹配中" : build ? "已自动匹配" : "暂不可用"}</Tag> : null}
            </div>
            {activeCore && version && build ? <div className="minecraft-core-artifact-summary">
              <Typography.Text>将安装 {activeCore.name} · Minecraft {version}</Typography.Text>
              <details className="minecraft-core-artifact-details"><summary>查看下载工件编号</summary><code>{build}</code></details>
            </div> : null}
            {activeCore && version && buildLoading && !packageAvailable ? <div className="minecraft-core-picker-empty">正在自动匹配服务端下载包…</div> : null}
            {activeCore && version && !buildLoading && !packageAvailable && !error ? <div className="minecraft-core-picker-empty">核心目录暂未返回可用下载包。</div> : null}
            {!activeCore || !version ? <div className="minecraft-core-picker-empty">选择核心和版本后，会自动匹配服务端下载包。</div> : null}
          </section>
        </div>
      </section> : null}
      {step === 1 ? <section className="minecraft-provision-section" aria-labelledby="minecraft-provision-options-title">
        <div className="minecraft-provision-section-heading">
          <Typography.Title id="minecraft-provision-options-title" level={5}>目标节点与实例参数</Typography.Title>
          <Typography.Text type="secondary">选择在线节点并填写名称、端口和内存后继续；这些参数只用于新建独立实例，不会覆盖已有文件。</Typography.Text>
        </div>
        <div className="minecraft-provision-fields">
          <label>目标节点<Select value={selectedNode?.id} onChange={value => { setNodeId(value); setBackendId(""); }} placeholder="选择实际执行节点" options={eligible.map(n => ({ value: n.id, label: n.displayName }))} /></label>
          <label>实例名称<Input value={name} onChange={event => setName(event.target.value)} maxLength={48} placeholder="例如：朋友的生存世界" /><Typography.Text type="secondary">按设置中心中目标节点的 Minecraft 实例目录创建独立文件夹，以实例名称命名；已有文件不会被覆盖。</Typography.Text></label>
          <label>监听端口<InputNumber min={1024} max={65535} value={port} onChange={setPort} /><Typography.Text type="secondary">{selectedCore?.category === "bedrock" ? "基岩使用 UDP" : "Java / 代理使用 TCP"}，自动检查本机占用；不会自动开放防火墙。</Typography.Text></label>
          {selectedCore?.launchKind !== "php" ? <label>最大内存（MB）<InputNumber min={1024} max={32768} step={512} value={memory} onChange={setMemory} /></label> : null}
          {selectedCore?.category === "proxy" ? <label>代理后端实例<Select value={backendId || undefined} onChange={setBackendId} options={backends.map(i => ({ value: i.id, label: `${i.name} · ${i.serverProperties.serverPort}` }))} placeholder="选择同节点已运行且已配置的 Java 后端" />{!backends.length ? <Typography.Text type="secondary">先配置并启动真实后端；代理不会替你关闭后端正版验证。</Typography.Text> : null}</label> : null}
        </div>
        {portConflict?<Alert type="warning" showIcon message="该端口已被此节点的实例登记，请选择其他端口。"/>:null}
        {nameConflict?<Alert type="warning" showIcon message="该节点已有同名实例，请修改名称。"/>:null}
      </section> : null}
      {step >= 1 && selectedNode && selectedCore?.launchKind!=="php" ? <section className="minecraft-provision-section" aria-label="部署运行环境">
        <Typography.Title level={5}>Java 运行环境</Typography.Title>
        <Typography.Paragraph>{requirement?`当前核心要求 Java ${requirement.javaMajor}，依据：${requirement.source}。${requirement.installed?"已检测到匹配环境，将优先复用。":"目标节点尚未检测到匹配环境，可以前往运行环境准备；自动部署也会按相同规则准备。"}`:requirementLoading?"正在核对所选核心的 Java 要求…":requirementError?"无法核实当前核心的 Java 要求。请重试，或交给 AI Work 检查来源。":"选择核心、版本、构建和目标节点后即可核对 Java 要求。"}</Typography.Paragraph>
        {requirementError?<Alert type="error" showIcon message="Java 要求核验失败" description={requirementError} action={<Button size="small" onClick={()=>setRequirementRetry(value=>value+1)}>重试核验</Button>}/>:null}
        <Select aria-label="部署 Java 环境" value={javaRuntimeId} onChange={setJavaRuntimeId} style={{width:"100%"}} options={[{value:"",label:"自动匹配已有环境，缺少时准备"},...(requirement?.runtimes??[]).map(runtime=>({value:runtime.runtimeId,label:`Java ${runtime.major} · ${runtime.version??runtime.vendor} · ${runtime.source}`}))]} />
        {!runtimeValid?<Alert type="warning" showIcon message="之前选择的 Java 不适用于当前版本或节点，请重新选择或使用自动匹配。"/>:null}
        <Space wrap><Button onClick={()=>onNavigate(`/games/environments?target=${encodeURIComponent(nodeId)}&return=minecraft`)}>管理运行环境并返回</Button><Button disabled={!canHandOffRuntime} onClick={()=>onPrepareWithAi(runtimePreparationPrompt)}>{requirementError?"交给 AI Work 检查来源":"交给 AI Work 准备"}</Button></Space>
        <Typography.Text type="secondary">离开页面会保留当前账户的部署草稿；返回后重新核对设备和核心。EULA 勾选不会保留。</Typography.Text>
      </section> : null}
      {step === 2 ? <>
      <section className="minecraft-wizard-review" aria-label="部署配置摘要">
        <div className="minecraft-wizard-review__heading"><div><Typography.Title level={5}>部署摘要</Typography.Title><Typography.Text type="secondary">开始前再核对一次；程序包会自动匹配并在节点上校验。</Typography.Text></div><Button type="link" onClick={() => moveToStep(1)}>修改实例设置</Button></div>
        <dl>
          <div><dt>服务端</dt><dd>{activeCore?.name ?? "尚未选择"} · Minecraft {version || "—"}</dd></div>
          <div><dt>下载包</dt><dd>{buildLoading ? "正在匹配…" : packageAvailable ? "目录自动匹配" : "当前不可用"}</dd></div>
          <div><dt>目标节点</dt><dd>{selectedNode?.displayName ?? "尚未选择"}</dd></div>
          <div><dt>实例名称</dt><dd>{name.trim() || "尚未填写"}</dd></div>
          <div><dt>监听端口</dt><dd>{port ?? "—"} · {activeCore?.category === "bedrock" ? "UDP" : "TCP"}</dd></div>
          {selectedCore?.launchKind !== "php" ? <div><dt>最大内存</dt><dd>{memory ? `${memory} MB` : "—"}</dd></div> : null}
          <div><dt>保存位置</dt><dd>使用设置中心中该节点的 Minecraft 实例目录</dd></div>
        </dl>
      </section>
      <section className="minecraft-provision-section minecraft-provision-section--execution" aria-labelledby="minecraft-provision-execution-title">
        <div className="minecraft-provision-section-heading">
          <Typography.Title id="minecraft-provision-execution-title" level={5}>执行与许可</Typography.Title>
          <Typography.Text type="secondary">提交前请核对执行边界并明确同意所需许可。</Typography.Text>
        </div>
        <div className="minecraft-provision-boundary">
          <strong>{modeNative ? "本机原生进程" : "当前选择 AppContainer"}</strong>
          <span>{modeNative ? "以目标 Daemon 的系统账户运行。运行环境按核心版本准备；此方式没有 OS 沙盒隔离。" : "多核心自动部署需要设置中心选定本机原生执行；此处不会静默切换执行方式。"}</span>
        </div>
      </section>
      <div className="minecraft-provision-submit">
        <div className="minecraft-eula">
          <Checkbox checked={eula} onChange={event => setEula(event.target.checked)}>我已阅读并同意</Checkbox>
          <Typography.Link href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer">Minecraft EULA</Typography.Link>
          <Typography.Text>及所选核心项目许可。提交后，Daemon 会在配置目录创建实例文件夹、写入 `eula=true` 并启动服务器；下载只从已核实来源拉取，校验失败会停止。</Typography.Text>
          <Typography.Text>EULA 同意只随本次部署请求提交；未勾选前不会创建实例。</Typography.Text>
        </div>
      </div>
      {!canOperate ? <Alert type="warning" showIcon message="当前账户为只读角色，需要管理员权限才能提交部署。" /> : null}
      {!modeNative ? <Alert type="warning" showIcon message="请先在设置中心切换为本机原生执行，再提交多核心自动部署。" /> : null}
      </> : null}
      <div className="minecraft-wizard-actions">
        <Button htmlType="button" disabled={step === 0 || submitting} onClick={() => moveToStep(Math.max(0,step-1))}>上一步</Button>
        {step < 2 ? <Button type="primary" htmlType="button" disabled={!nextStepReady} onClick={() => moveToStep(Math.min(2,step+1))}>{step === 1 ? "核对部署信息" : "下一步"}</Button> : <Button type="primary" htmlType="submit" loading={submitting} disabled={!valid}>自动部署并启动</Button>}
      </div>
    </form>
  </Card>;
}

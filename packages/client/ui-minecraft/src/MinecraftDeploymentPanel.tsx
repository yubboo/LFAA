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
  onSubmit: (operation: () => Promise<unknown>, returnToTasks?: boolean) => Promise<boolean>;
  onNavigate: (path: string) => void;
}
const categoryNames = { pure: "纯净与插件", mod: "模组与混合", vanilla: "原版", proxy: "代理", bedrock: "基岩" };
const categoryDescriptions: Record<MinecraftCore["category"], string> = {
  pure: "原版增强与插件生态", mod: "模组及混合核心", vanilla: "Minecraft 官方原版", proxy: "连接 Java 后端实例", bedrock: "基岩版运行核心"
};
const coreDescriptions: Record<string, string> = {
  Paper: "普通生存、多人联机和插件服的推荐选择。多数 Bukkit/Spigot 插件使用这一类核心。",
  Vanilla: "保持 Mojang 原版行为，不支持 Bukkit 插件或 Forge/Fabric 模组。",
  Fabric: "适合 Fabric 模组包；客户端模组与服务器版本需要按模组包要求一致。",
  Forge: "适合 Forge 模组包；自动运行安装器并准备服务端依赖。",
  Folia: "适合明确支持 Folia 的插件服；普通 Paper 插件不能假定兼容。",
  Purpur: "基于 Paper 提供更多玩法配置，适合需要细调玩法的插件服。",
  Leaves: "面向希望保留更多原版机制的插件服；请核对所用插件兼容性。",
  Arclight: "模组与插件混合核心，所选版本后缀决定 Forge、NeoForge 或 Fabric 加载器。",
  CatServer: "模组与插件混合核心；模组、插件和核心版本必须相互兼容。",
  Youer: "NeoForge 与 Paper/Purpur 混合核心；从 Mohist 官网拉取对应版本程序包。",
  SpongeForge: "Forge + Sponge 插件；自动安装匹配的 Forge 加载器。",
  SpongeNeo: "NeoForge + Sponge 插件；自动安装匹配的 NeoForge 加载器。",
  SpongeVanilla: "原版游戏与 Sponge 插件；不能直接当作 Bukkit 插件服使用。",
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
const coreCatalogCache=createSnapshotCache<Awaited<ReturnType<typeof loadMinecraftCores>>>();
const coreBuildCache=createSnapshotCache<Awaited<ReturnType<typeof loadMinecraftCoreBuilds>>>();
export function MinecraftDeploymentPanel({ userId,onPrepareWithAi,nodes, instances, settings, canOperate, onSubmit, onNavigate }: Props) {
  const draft=useRef(draftCache.get(userId)).current;
  const cachedCoreCatalog=useRef(coreCatalogCache.get(userId)??null).current;
  const [cores, setCores] = useState<MinecraftCore[]>(()=>cachedCoreCatalog?.cores??[]), [sourceErrors, setSourceErrors] = useState<string[]>(()=>cachedCoreCatalog?.errors??[]);
  const [catalogLoading, setCatalogLoading] = useState(true), [reload, setReload] = useState(0);
  const [core, setCore] = useState(draft?.core??settings.minecraftRuntime.minecraftDefaultCore), [version, setVersion] = useState(draft?.version??""), [build, setBuild] = useState("");
  const [category, setCategory] = useState<MinecraftCore["category"] | "">(""), [coreSearch, setCoreSearch] = useState(""), [visibleVersionCount, setVisibleVersionCount] = useState(24);
  const [packageAvailable, setPackageAvailable] = useState(false), [buildLoading, setBuildLoading] = useState(false);
  const [nodeId, setNodeId] = useState(draft?.nodeId??""), [name, setName] = useState(draft?.name??""), [backendId, setBackendId] = useState(draft?.backendId??"");
  const [javaRuntimeId,setJavaRuntimeId]=useState(draft?.javaRuntimeId??"");
  const [requirement,setRequirement]=useState<Awaited<ReturnType<typeof loadMinecraftRuntimeRequirement>>|null>(null);
  const [memory, setMemory] = useState<number | null>(draft?.memory??settings.minecraftRuntime.minecraftDefaultMemoryMb);
  const [port, setPort] = useState<number | null>(draft?.port??settings.minecraftRuntime.minecraftDefaultPort);
  const [eula, setEula] = useState(false), [submitting, setSubmitting] = useState(false), [error, setError] = useState("");
  const [step, setStep] = useState(draft?.step??0);
  const refreshBuildKey=useRef<string|null>(null);
  useEffect(()=>{draftCache.set(userId,{core,version,nodeId,name,backendId,memory,port,step,javaRuntimeId});},[userId,core,version,nodeId,name,backendId,memory,port,step,javaRuntimeId]);
  useEffect(()=>{setRequirement(null);if(step<1||!nodeId||!version||!build||!canOperate)return;const controller=new AbortController();void loadMinecraftRuntimeRequirement({core,version,build,nodeId},controller.signal).then(setRequirement).catch(reason=>{if(!controller.signal.aborted)setError(getErrorMessage(reason));});return()=>controller.abort();},[core,version,build,nodeId,canOperate,step]);
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
    let alive = true; setCatalogLoading(true);
    const controller=new AbortController();
    loadMinecraftCores(controller.signal).then(value => { if (alive) { coreCatalogCache.set(userId,value); setCores(value.cores); setSourceErrors(value.errors); } }).catch(reason => { if (alive&&!controller.signal.aborted) { const message=getErrorMessage(reason); const unavailable={cores:[],errors:[message]}; coreCatalogCache.set(userId,unavailable); setCores([]); setSourceErrors(unavailable.errors); } }).finally(() => { if (alive) setCatalogLoading(false); });
    return () => { alive = false; controller.abort(); };
  }, [reload, userId]);
  useEffect(() => {
    if (catalogLoading) return;
    if (!selectedCore) {
      if (core) setCore("");
      if (version) setVersion("");
      setBuild("");
      setPackageAvailable(false);
      return;
    }
    if (versions.length) setVersion(current => versions.includes(current) ? current : versions[0] ?? "");
    else if (version) setVersion("");
  }, [catalogLoading, core, selectedCore, version, versions]);
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
    if (catalogLoading || !selectedCore || !version) { setBuildLoading(false); return; }
    const cacheKey=`${userId}\u001f${core}\u001f${version}`;
    const cached=coreBuildCache.get(cacheKey);
    if(cached&&refreshBuildKey.current!==cacheKey){const preferredArtifact=cached.builds[0];setBuild(preferredArtifact?.id??"");setPackageAvailable(Boolean(preferredArtifact?.id));setBuildLoading(false);return()=>{buildSequence.current++;};}
    if(refreshBuildKey.current===cacheKey)refreshBuildKey.current=null;
    const controller=new AbortController();
    setBuildLoading(true);
    loadMinecraftCoreBuilds(core, version, 0, controller.signal).then(value => { if (sequence === buildSequence.current) { coreBuildCache.set(cacheKey,value); const preferredArtifact = value.builds[0]; setBuild(preferredArtifact?.id ?? ""); setPackageAvailable(Boolean(preferredArtifact?.id)); } }).catch(reason => { if (!controller.signal.aborted&&sequence === buildSequence.current) setError(getErrorMessage(reason)); }).finally(() => { if (sequence === buildSequence.current) setBuildLoading(false); });
    return () => { buildSequence.current++; controller.abort(); };
  }, [catalogLoading, core, selectedCore, version, reload, userId]);
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
  const valid = canOperate && sourceReady && instanceReady && modeNative && eula;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (step !== 2 || !valid || !memory || !port) return; setSubmitting(true);
    try {
      const success = await onSubmit(() => provisionMinecraftServer({ nodeId, name: name.trim(), core, version, build, eulaAccepted: true, memoryMb: memory, serverPort: port,javaRuntimeId:javaRuntimeId||null, ...(activeCore?.category === "proxy" ? { proxyBackendInstanceId: backendId } : {}) }), true);
      if (success) {
        draftCache.set(userId,{core,version,nodeId,name:"",backendId:"",memory,port:settings.minecraftRuntime.minecraftDefaultPort,step:0,javaRuntimeId:""});
        setName(""); setEula(false); setStep(0);
      }
    } finally { setSubmitting(false); }
  };
  return <Card className="minecraft-card minecraft-create-card minecraft-provision-card">
    <div className="minecraft-card-heading minecraft-deployment-card-heading">
      <div>
        <Typography.Title level={4}>新建 Minecraft 服务器</Typography.Title>
        <Typography.Paragraph>按步骤选择核心、配置目标节点并核对部署信息。提交后由所选节点下载、校验、安装并启动。</Typography.Paragraph>
      </div>
      <Button onClick={() => {refreshBuildKey.current=`${userId}\u001f${core}\u001f${version}`;setReload(value => value + 1);}} loading={catalogLoading}>刷新核心目录</Button>
    </div>
    <div className="minecraft-provision-alerts">
      {sourceErrors.map(message => <Alert key={message} type="warning" showIcon message={message} />)}
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {!eligible.length ? <Alert type="warning" showIcon message="尚无在线的多核心执行节点" description="控制端连接正常不代表 Daemon 在线。进入控制节点启动本机服务，或连接远程执行节点。" action={<Button onClick={() => onNavigate("/apps/minecraft/normal/nodes")}>检查节点</Button>} /> : null}
      {!modeNative ? <Alert type="warning" showIcon message="当前设置选择 AppContainer" description="多核心自动安装需要推荐的本机原生执行方式。请在设置中心修改执行方式；此处不会静默回退。" /> : null}
      {core === "SpongeForge" && settings.minecraftRuntime.minecraftStopTimeoutSeconds < 90 ? <Alert type="info" showIcon message="SpongeForge 建议将安全停服等待设为 90 秒" description="本次实机中 30 秒会触发强制结束，90 秒完成正常退出。可在设置中心调整 Minecraft 停服等待时间；此处保留你的已保存设置。" /> : null}
    </div>
    <ol className="minecraft-wizard-progress" aria-label="部署步骤">
      {["选择服务端", "设置实例", "核对并部署"].map((label, index) => <li className={step === index ? "is-current" : step > index ? "is-complete" : ""} aria-current={step === index ? "step" : undefined} key={label}>
        <span className="minecraft-wizard-progress__number">{step > index ? "✓" : index + 1}</span><span>{label}</span>
      </li>)}
    </ol>
    <div className="minecraft-wizard-intro" aria-live="polite">
      <Typography.Title level={5}>{["选择服务端核心和版本", "设置实例运行位置", "确认部署信息和许可"][step]}</Typography.Title>
      <Typography.Text type="secondary">{[
        "先选适合玩法的服务端核心，再选 Minecraft 版本。系统会自动匹配可信下载包。",
        "选择实际运行服务器的在线节点，并设置实例名称、端口和内存。",
        "确认节点和参数无误后阅读许可。只有明确勾选 EULA，才会提交部署任务。"
      ][step]}</Typography.Text>
    </div>
    <form className="minecraft-provision-form" onSubmit={submit}>
      {step === 0 ? <section className="minecraft-core-library" aria-label="服务端核心资源库">
        <nav className="minecraft-core-categories" aria-label="服务端类型">
          <div className="minecraft-core-categories__heading">
            <div><Typography.Title level={5}>分类导航</Typography.Title><Typography.Text type="secondary">只显示当前目录中的类型</Typography.Text></div>
            <Tag>{coreCategories.length} 类</Tag>
          </div>
          <div className="minecraft-core-categories__list">
            {catalogLoading && !coreCategories.length ? <Typography.Text type="secondary">正在读取核心分类…</Typography.Text> : null}
            {coreCategories.map(item => <button
              aria-current={category === item.value ? "true" : undefined}
              className="minecraft-core-category"
              key={item.value}
              onClick={() => changeCategory(item.value)}
              type="button"
            >
              <span className="minecraft-core-category__mark" aria-hidden="true">{item.label.slice(0, 1)}</span>
              <span className="minecraft-core-category__copy"><strong>{item.label}</strong><small>{categoryDescriptions[item.value]}</small></span>
              <Tag>{item.count}</Tag>
            </button>)}
            {!catalogLoading && !coreCategories.length ? <Typography.Text type="secondary">目录暂未提供可选分类。</Typography.Text> : null}
          </div>
        </nav>
        <div className="minecraft-core-browser">
          <div className="minecraft-core-browser__heading">
            <div>
              <div className="minecraft-core-browser__title"><Typography.Title level={5}>选择具体核心分支</Typography.Title>{selectedCore ? <Tag color={activeCore ? "blue" : undefined}>{activeCore ? `已选 ${activeCore.name}` : `表单当前为 ${selectedCore?.name}`}</Tag> : null}</div>
              <Typography.Text type="secondary">按分类浏览真实核心目录；选择分支后加载对应版本。</Typography.Text>
            </div>
            <Input aria-label="搜索当前分类核心" allowClear value={coreSearch} onChange={event => setCoreSearch(event.target.value)} placeholder="搜索核心名称…" />
          </div>
          <div className="minecraft-core-option-grid" role="group" aria-label="核心分支">
            {catalogLoading && !cores.length ? <div className="minecraft-core-picker-empty">正在读取核心目录…</div> : null}
            {!catalogLoading && cores.length > 0 && !categoryCores.length ? <div className="minecraft-core-picker-empty">这个分类当前没有可用核心。</div> : null}
            {!catalogLoading && categoryCores.length > 0 && !visibleCores.length ? <div className="minecraft-core-picker-empty">当前分类没有匹配“{coreSearch.trim()}”的核心。</div> : null}
            {visibleCores.map(item => <button
              aria-pressed={core === item.name}
              className={`minecraft-core-option${core === item.name ? " is-selected" : ""}`}
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
            <Typography.Text>{coreDescriptions[activeCore.name] ?? "请核对核心用途与所需模组/插件兼容性。"}</Typography.Text>
            <Space><Tag>{categoryNames[activeCore.category]}</Tag><Typography.Link href={activeCore.homepage} target="_blank" rel="noreferrer">核心项目说明</Typography.Link></Space>
          </div> : <div className="minecraft-core-picker-empty minecraft-core-picker-empty--hint">{selectedCore ? `表单仍保留 ${selectedCore.name}。请选择当前分类中的核心，版本会随之切换。` : "先选择一个核心分支，再查看它支持的版本。"}</div>}
          <section className="minecraft-core-version-section" aria-labelledby="minecraft-provision-version-title">
            <div className="minecraft-core-subheading">
              <div><Typography.Title id="minecraft-provision-version-title" level={5}>{activeCore ? `选择${activeCore.category === "proxy" || activeCore.category === "bedrock" ? "核心版本通道" : "Minecraft 版本"}` : "选择版本"}</Typography.Title><Typography.Text type="secondary">{activeCore ? "版本来自核心目录；部署时由目标节点下载并校验。" : "选择核心分支后显示它的实际版本。"}</Typography.Text></div>
              {activeCore ? <Tag>{versions.length} 个版本</Tag> : null}
            </div>
            {activeCore && versions.length ? <div className="minecraft-core-version-grid" role="group" aria-label="可用版本">
              {visibleVersions.map(value => <button aria-pressed={version === value} className={`minecraft-core-version${version === value ? " is-selected" : ""}`} key={value} onClick={() => setVersion(value)} type="button"><span>{value}</span>{version === value ? <span aria-hidden="true">✓</span> : null}</button>)}
            </div> : null}
            {activeCore && !versions.length && !catalogLoading ? <div className="minecraft-core-picker-empty">核心目录暂未返回可用版本。</div> : null}
            {!activeCore ? <div className="minecraft-core-picker-empty">先选择一个核心分支，版本列表会显示在这里。</div> : null}
            {activeCore && visibleVersionCount < versions.length ? <Button className="minecraft-provision-load-more" htmlType="button" onClick={loadMoreVersions}>加载更多版本（已显示 {visibleVersionCount}/{versions.length}）</Button> : null}
          </section>
          <section className="minecraft-core-package-section" aria-labelledby="minecraft-provision-package-title">
            <div className="minecraft-core-subheading">
              <div><Typography.Title id="minecraft-provision-package-title" level={5}>服务端下载包</Typography.Title><Typography.Text type="secondary">选择核心和 Minecraft 版本后，系统会自动匹配目录中的程序包并在部署时校验来源摘要。</Typography.Text></div>
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
        <Typography.Paragraph>{requirement?`当前核心要求 Java ${requirement.javaMajor}，依据：${requirement.source}。${requirement.installed?"已检测到匹配环境，将优先复用。":"目标节点尚未检测到匹配环境，可以前往运行环境准备；自动部署也会按相同规则准备。"}`:"正在核对所选核心的 Java 要求…"}</Typography.Paragraph>
        <Select aria-label="部署 Java 环境" value={javaRuntimeId} onChange={setJavaRuntimeId} style={{width:"100%"}} options={[{value:"",label:"自动匹配已有环境，缺少时准备"},...(requirement?.runtimes??[]).map(runtime=>({value:runtime.runtimeId,label:`Java ${runtime.major} · ${runtime.version??runtime.vendor} · ${runtime.source}`}))]} />
        {!runtimeValid?<Alert type="warning" showIcon message="之前选择的 Java 不适用于当前版本或节点，请重新选择或使用自动匹配。"/>:null}
        <Space wrap><Button onClick={()=>onNavigate(`/games/environments?target=${encodeURIComponent(nodeId)}&return=minecraft`)}>管理运行环境并返回</Button><Button disabled={!requirement} onClick={()=>onPrepareWithAi(`请为我的手动部署准备运行环境。核心 ${core}，游戏版本 ${version}，构建 ${build}，实例名称 ${name.trim()||"待填写"}；目标节点 ${selectedNode.displayName}（${nodeId}），已核实需要 Java ${requirement!.javaMajor}（来源 ${requirement!.source}）。优先复用该设备已有环境，缺少时按设备的项目与存储设置准备。完成后我会返回保留的手动部署草稿继续核对。`)}>交给 AI Work 准备</Button></Space>
        <Typography.Text type="secondary">离开页面会保留当前账户的部署草稿；返回后重新核对设备和核心。EULA 勾选不会保留。</Typography.Text>
      </section> : null}
      {step === 2 ? <>
      <section className="minecraft-wizard-review" aria-label="部署配置摘要">
        <div className="minecraft-wizard-review__heading"><div><Typography.Title level={5}>部署摘要</Typography.Title><Typography.Text type="secondary">开始前再核对一次；程序包会自动匹配并在节点上校验。</Typography.Text></div><Button type="link" onClick={() => setStep(1)}>修改实例设置</Button></div>
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
        <Button htmlType="button" disabled={step === 0 || submitting} onClick={() => setStep(current => Math.max(0, current - 1))}>上一步</Button>
        {step < 2 ? <Button type="primary" htmlType="button" disabled={step === 0 ? !sourceReady : !instanceReady} onClick={() => setStep(current => Math.min(2, current + 1))}>{step === 1 ? "核对部署信息" : "下一步"}</Button> : <Button type="primary" htmlType="submit" loading={submitting} disabled={!valid}>自动部署并启动</Button>}
      </div>
    </form>
  </Card>;
}

/** 功能：跨游戏创建与管理联机路线。作用：把联网独立于具体游戏的部署/进程工作区。 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Form, Input, Select, Space, Tag, Typography } from "antd";
import type { FormInstance } from "antd";
import { createConnectivityRoute, deleteConnectivityRoute, deleteConnectivityProviderCredential, installConnectivityEasyTier, loadConnectivityEasyTierTasks, loadConnectivityOverview, loadConnectivityProviderCatalog, saveConnectivityProviderCredential, type ConnectivityEasyTierTask, type ConnectivityOverview, type ConnectivityRoute } from "lfaa-client-connection/src/api.js";
import "./connectivity.css";

const methodLabels: Record<ConnectivityRoute["mode"], string> = { "room-domain": "LFAA 房间域名", "self-managed": "自备穿透", provider: "第三方 Provider" };
const stateLabels: Record<ConnectivityRoute["state"], string> = { manual: "地址已记录", "waiting-for-node": "等待节点接入", connected: "节点已接入 Relay", offline: "节点离线", failed: "连接失败" };
const easyTierTaskLabels: Record<ConnectivityEasyTierTask["status"], string> = { queued: "等待节点接单", running: "安装并校验中", succeeded: "安装并校验完成", failed: "安装失败", unknown: "结果未确认" };

export function ConnectivityWorkspace({ section, isAdmin }: { section: string; isAdmin: boolean }) {
  const [overview, setOverview] = useState<ConnectivityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [easyTierTasks, setEasyTierTasks] = useState<ConnectivityEasyTierTask[]>([]);
  const [easyTierNodeId, setEasyTierNodeId] = useState("");
  const [form] = Form.useForm<Record<string, unknown>>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextOverview, taskResult] = await Promise.all([loadConnectivityOverview(), loadConnectivityEasyTierTasks()]);
      setOverview(nextOverview);
      setEasyTierTasks(taskResult.tasks);
      setEasyTierNodeId(current => nextOverview.nodes.some(node => node.id === current) ? current : nextOverview.nodes[0]?.id ?? "");
    }
    catch (loadError: unknown) { setError(loadError instanceof Error ? loadError.message : "联机服务状态读取失败。"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const targets = overview?.targets ?? [];
  const nodes = overview?.nodes ?? [];
  const selectedTargetId = Form.useWatch("targetId", form) as string | undefined;
  const selectedTarget = targets.find(target => target.id === selectedTargetId);
  const selectedProtocol = Form.useWatch("transport", form) as "tcp" | "udp" | undefined;
  const providerReady = (overview?.providers.length ?? 0) > 0;
  const sortedRoutes = useMemo(() => [...(overview?.routes ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [overview?.routes]);

  const createRoute = async (values: Record<string, unknown>) => {
    setBusy(true); setNotice(""); setError("");
    try {
      await createConnectivityRoute({
        sourceAppId: String(values.sourceAppId) as ConnectivityRoute["sourceAppId"],
        targetId: values.sourceAppId === "custom" ? null : String(values.targetId),
        name: String(values.name), mode: values.mode as ConnectivityRoute["mode"],
        transport: (values.sourceAppId === "custom" ? values.transport : selectedTarget?.transport) as "tcp" | "udp",
        ...(values.sourceAppId === "custom" ? { nodeId: String(values.nodeId), localPort: Number(values.localPort) } : {}),
        ...(values.mode === "self-managed" ? { playerAddress: String(values.playerAddress ?? "") } : {})
      });
      form.resetFields(["name", "playerAddress"]);
      setNotice("路线已创建。房间 Relay 的接入状态以 Daemon 的真实回报为准。");
      await refresh();
    } catch (createError: unknown) { setError(createError instanceof Error ? createError.message : "联机路线创建失败。"); }
    finally { setBusy(false); }
  };

  const removeRoute = async (route: ConnectivityRoute) => {
    setBusy(true); setError("");
    try { await deleteConnectivityRoute(route.id); setNotice(`已删除“${route.name}”。`); await refresh(); }
    catch (removeError: unknown) { setError(removeError instanceof Error ? removeError.message : "联机路线删除失败。"); }
    finally { setBusy(false); }
  };

  const copyAddress = async (address: string) => {
    try { await navigator.clipboard.writeText(address); setNotice("玩家地址已复制。"); }
    catch { setError("浏览器拒绝访问剪贴板，请手动选中地址复制。"); }
  };

  const saveProvider = async (providerId: string, token: string) => {
    setBusy(true); setError("");
    try { await saveConnectivityProviderCredential(providerId, token); setNotice("令牌已加密保存。令牌正文不会在读取 API 中返回。"); await refresh(); }
    catch (saveError: unknown) { setError(saveError instanceof Error ? saveError.message : "令牌保存失败。"); }
    finally { setBusy(false); }
  };

  const removeProvider = async (providerId: string) => {
    setBusy(true);
    try { await deleteConnectivityProviderCredential(providerId); setNotice("已移除该 Provider 令牌。"); await refresh(); }
    catch (removeError: unknown) { setError(removeError instanceof Error ? removeError.message : "令牌移除失败。"); }
    finally { setBusy(false); }
  };

  const queryProvider = async (providerId: string) => {
    setBusy(true); setError("");
    try { await loadConnectivityProviderCatalog(providerId); setNotice("Provider 节点目录已更新。"); await refresh(); }
    catch (catalogError: unknown) { setError(catalogError instanceof Error ? catalogError.message : "Provider 目录读取失败。"); }
    finally { setBusy(false); }
  };

  const installEasyTier = async (nodeId: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const { task } = await installConnectivityEasyTier(nodeId);
      setNotice(`已提交 EasyTier ${overview?.easyTier.version ?? ""} 官方运行包安装任务。可以刷新查看 Daemon 回报。`);
      await refresh();
      setEasyTierTasks(current => current.some(item => item.id === task.id) ? current : [task, ...current].slice(0, 10));
    } catch (installError: unknown) { setError(installError instanceof Error ? installError.message : "EasyTier 安装任务提交失败。"); }
    finally { setBusy(false); }
  };

  const isOverview = section === "overview";
  const isProviders = section === "providers";
  const isSelfManaged = section === "self-managed";
  const isRoomDomain = section === "room-domain";
  const methodFilter = isProviders ? "provider" : isSelfManaged ? "self-managed" : isRoomDomain ? "room-domain" : null;
  const visibleRoutes = methodFilter ? sortedRoutes.filter(route => route.mode === methodFilter) : sortedRoutes;

  return <div className="connectivity-workspace">
    <header className="connectivity-heading">
      <div><Typography.Text className="connectivity-kicker">LFAA NETWORK SERVICE</Typography.Text><Typography.Title level={2}>联机服务</Typography.Title><Typography.Paragraph>一次配置，多款游戏共用。开服、房间和公网映射各自管理。</Typography.Paragraph></div>
      <Button onClick={() => void refresh()} loading={loading}>刷新状态</Button>
    </header>

    {error ? <Alert type="error" showIcon message={error} /> : null}
    {notice ? <Alert type="success" showIcon closable message={notice} onClose={() => setNotice("")} /> : null}

    {isOverview ? <>
      <section className="connectivity-status-grid" aria-label="联机服务状态">
        <Card className="connectivity-status-card"><Typography.Text type="secondary">房间域名 Relay</Typography.Text><Typography.Title level={4}>{loading ? "正在读取" : overview?.deployment.roomDomain.configured ? "已配置" : "待配置"}</Typography.Title><Typography.Text>{overview?.deployment.roomDomain.publicDomain ?? "尚未配置公共域名"}</Typography.Text></Card>
        <Card className="connectivity-status-card"><Typography.Text type="secondary">已管理路线</Typography.Text><Typography.Title level={4}>{overview?.routes.length ?? 0}</Typography.Title><Typography.Text>账户隔离保存，状态来自真实节点</Typography.Text></Card>
        <Card className="connectivity-status-card"><Typography.Text type="secondary">第三方 Provider</Typography.Text><Typography.Title level={4}>{overview?.providers.length ?? 0}</Typography.Title><Typography.Text>只显示已完成官方接口核验的服务</Typography.Text></Card>
      </section>

      {!overview?.deployment.roomDomain.configured ? <Alert className="connectivity-alert" type="warning" showIcon message="房间域名暂不可创建" description={overview?.deployment.roomDomain.reason ?? "正在读取 Relay 配置。"} /> : null}
      <RouteList routes={visibleRoutes} busy={busy} onCopy={copyAddress} onDelete={removeRoute} />
    </> : isProviders ? <>
      <Card className="connectivity-panel">
        <div className="connectivity-panel-heading"><div><Typography.Title level={4}>官方 Provider 接入</Typography.Title><Typography.Paragraph>令牌由供应商签发；LFAA 只通过已核验的官方 API 读取节点和创建映射。</Typography.Paragraph></div><Tag color={providerReady ? "green" : "default"}>{providerReady ? `${overview?.providers.length} 项已接入` : "暂无已核验接口"}</Tag></div>
        {!providerReady ? <Alert type="info" showIcon message="目前没有可用的第三方 API 适配器" description="SakuraFrp 的官方 API 规格尚未核实，因此不会请求节点、接收令牌或显示虚构的可用状态。接口适配器就绪后会在这里单独管理。" /> : null}
        {overview?.providers.map(provider => <ProviderCard key={provider.id} provider={provider} busy={busy} onSave={saveProvider} onRemove={removeProvider} onQuery={queryProvider} />)}
      </Card>
      <RouteList routes={visibleRoutes} busy={busy} onCopy={copyAddress} onDelete={removeRoute} />
    </> : isSelfManaged ? <>
      <Card className="connectivity-panel">
        <Typography.Title level={4}>自备穿透服务</Typography.Title>
        <Typography.Paragraph>你已经自行下载并启动外部穿透程序时，在这里记录它实际给出的玩家地址。LFAA 不会下载、启动、更新、停止或探测该程序。</Typography.Paragraph>
        <RouteCreator form={form} busy={busy} isAdmin={isAdmin} targets={targets} nodes={nodes} selectedTarget={selectedTarget} selectedProtocol={selectedProtocol} routeMode="self-managed" relayReady={false} onlySelfManaged onSubmit={createRoute} />
      </Card>
      <RouteList routes={visibleRoutes} busy={busy} onCopy={copyAddress} onDelete={removeRoute} />
    </> : isRoomDomain ? <>
      <Card className="connectivity-panel">
        <Typography.Title level={4}>LFAA 房间域名</Typography.Title>
        <Typography.Paragraph>房间名由本 App 分配到独立地址。Minecraft Java 可使用域名直连；其它 TCP 游戏与 UDP 游戏会显示实际分配端口。房间域名服务不影响游戏开服和实例状态。</Typography.Paragraph>
        {!overview?.deployment.roomDomain.configured ? <Alert type="warning" showIcon message="运营 Relay 尚未配置" description={overview?.deployment.roomDomain.reason ?? "正在读取 Relay 配置。"} /> : null}
        <RouteCreator form={form} busy={busy} isAdmin={isAdmin} targets={targets} nodes={nodes} selectedTarget={selectedTarget} selectedProtocol={selectedProtocol} routeMode="room-domain" relayReady={Boolean(overview?.deployment.roomDomain.configured)} onSubmit={createRoute} />
      </Card>
      <RouteList routes={visibleRoutes} busy={busy} onCopy={copyAddress} onDelete={removeRoute} />
    </> : <>
      <EasyTierEngineCard overview={overview} tasks={easyTierTasks} selectedNodeId={easyTierNodeId} isAdmin={isAdmin} busy={busy} onSelectNode={setEasyTierNodeId} onInstall={installEasyTier} onRefresh={() => void refresh()} />
    </>}
  </div>;
}

function EasyTierEngineCard({ overview, tasks, selectedNodeId, isAdmin, busy, onSelectNode, onInstall, onRefresh }: {
  overview: ConnectivityOverview | null; tasks: ConnectivityEasyTierTask[]; selectedNodeId: string; isAdmin: boolean; busy: boolean;
  onSelectNode: (nodeId: string) => void; onInstall: (nodeId: string) => Promise<void>; onRefresh: () => void;
}) {
  const nodes = overview?.nodes.filter(node => node.capabilities.includes(overview.easyTier.installCapability)) ?? [];
  const selectedNode = nodes.find(node => node.id === selectedNodeId);
  const installed = selectedNode?.capabilities.includes(overview?.easyTier.runtimeCapability ?? "") ?? false;
  const pendingTask = tasks.find(task => task.nodeId === selectedNodeId && (task.status === "queued" || task.status === "running"));
  return <Card className="connectivity-panel">
    <div className="connectivity-panel-heading"><div><Typography.Title level={4}>组网引擎与联机扩展</Typography.Title><Typography.Paragraph>在同一个联机 App 中管理独立的 EasyTier 组网引擎。游戏开服仍由对应游戏 App 管理。</Typography.Paragraph></div><Tag color={installed ? "green" : "default"}>{installed ? `EasyTier ${overview?.easyTier.version} 已核验` : "引擎待安装"}</Tag></div>
    {nodes.length ? <>
      <Form layout="vertical">
        <Form.Item label="目标 Windows x64 节点"><Select value={selectedNodeId || undefined} onChange={onSelectNode} options={nodes.map(node => ({ value: node.id, label: `${node.displayName}${node.capabilities.includes(overview?.easyTier.runtimeCapability ?? "") ? ` · EasyTier ${overview?.easyTier.version} 已核验` : " · 尚未安装"}` }))} /></Form.Item>
      </Form>
      <Alert type={installed ? "success" : "info"} showIcon message={installed ? `EasyTier ${overview?.easyTier.version} 运行包已通过节点版本核验` : "尚未安装 EasyTier 运行包"} description={installed ? "当前只确认官方运行包已安装。组网实例、虚拟 IP 和对等节点状态将在后续阶段接入真实管理 RPC 后展示。" : "管理员可以提交安装任务。Daemon 会从 EasyTier 官方发行页下载固定版本，核验 SHA-256 与核心程序版本后安装；本操作不会启动组网、修改网卡或防火墙。"} />
      {pendingTask ? <Alert className="connectivity-alert" type="info" showIcon message={easyTierTaskLabels[pendingTask.status]} description={pendingTask.message} /> : null}
      {isAdmin ? <Button type="primary" loading={busy} disabled={!selectedNode || installed || Boolean(pendingTask)} onClick={() => selectedNode && void onInstall(selectedNode.id)}>{pendingTask ? easyTierTaskLabels[pendingTask.status] : installed ? "运行包已核验" : `安装并校验 EasyTier ${overview?.easyTier.version ?? ""}`}</Button> : <Typography.Text type="secondary">运行包安装由管理员执行；节点版本状态对账户可见。</Typography.Text>}
    </> : <Alert type="warning" showIcon message="没有可用的在线安装节点" description="需要新版 LFAA Windows x64 Daemon 报告 EasyTier 固定安装能力。" />}
    <div className="connectivity-panel-heading"><Typography.Title level={5}>最近的引擎任务</Typography.Title><Button size="small" onClick={onRefresh} loading={busy}>刷新状态</Button></div>
    {tasks.length ? <Space direction="vertical" size="small" style={{ width: "100%" }}>{tasks.slice(0, 5).map(task => <Typography.Text key={task.id} type="secondary">{nodes.find(node => node.id === task.nodeId)?.displayName ?? `节点 ${task.nodeId.slice(0, 8)}`} · {easyTierTaskLabels[task.status]} · {task.message}</Typography.Text>)}</Space> : <Typography.Text type="secondary">暂无 EasyTier 安装任务。</Typography.Text>}
  </Card>;
}

function RouteCreator({ form, busy, isAdmin, targets, nodes, selectedTarget, selectedProtocol, routeMode, relayReady, onlySelfManaged = false, onSubmit }: {
  form: FormInstance<Record<string, unknown>>; busy: boolean; isAdmin: boolean; targets: ConnectivityOverview["targets"]; nodes: ConnectivityOverview["nodes"];
  selectedTarget: ConnectivityOverview["targets"][number] | undefined; selectedProtocol: "tcp" | "udp" | undefined;
  routeMode: ConnectivityRoute["mode"] | undefined; relayReady: boolean; onlySelfManaged?: boolean; onSubmit: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [kind, setKind] = useState<"minecraft" | "custom">(targets.some(target => target.applicationId === "minecraft") ? "minecraft" : "custom");
  useEffect(() => {
    form.setFieldsValue({ sourceAppId: kind === "minecraft" && targets.some(target => target.applicationId === "minecraft") ? "minecraft" : "custom", transport: "tcp", mode: onlySelfManaged ? "self-managed" : "room-domain" });
  }, [form, kind, onlySelfManaged, targets]);
  const choices = targets.filter(target => kind === "minecraft" ? target.applicationId === "minecraft" : false);
  return <Form form={form} layout="vertical" onFinish={(values: Record<string, unknown>) => void onSubmit(values)} className="connectivity-route-form">
    <Typography.Title level={4}>{onlySelfManaged ? "记录自备服务地址" : "新建游戏房间"}</Typography.Title>
    <div className="connectivity-form-grid">
      <Form.Item name="name" label="路线名称" rules={[{ required: true, message: "请给这条路线取个名字。" }]}><Input maxLength={64} placeholder="例如：周末生存服" /></Form.Item>
      <Form.Item label="游戏服务目标" required>
        <Select value={kind} onChange={(value: "minecraft" | "custom") => setKind(value)} options={[{ value: "minecraft", label: "Minecraft Java 实例" }, { value: "custom", label: "自定义 TCP / UDP 目标" }]} />
      </Form.Item>
      {kind === "minecraft" && choices.length ? <Form.Item name="targetId" label="运行中的实例" rules={[{ required: true, message: "请选择运行中的 Minecraft 实例。" }]}><Select placeholder="选择实例" options={choices.map(target => ({ value: target.id, label: `${target.name} · ${target.nodeName} · ${target.localPort}` }))} onChange={(value) => { const target = targets.find(item => item.id === value); if (target) form.setFieldValue("transport", target.transport); }} /></Form.Item> : null}
      {kind === "minecraft" && !choices.length ? <Alert type="info" showIcon message="没有可用的 Minecraft 目标" description="只列出当前账户拥有、节点在线且真实运行的实例。" /> : null}
      {kind === "custom" ? <>
        <Form.Item name="nodeId" label="在线 Daemon 节点" rules={[{ required: true, message: "请选择在线节点。" }]}><Select placeholder="选择节点" options={nodes.map(node => ({ value: node.id, label: `${node.displayName} · ${node.platform}/${node.architecture}` }))} disabled={!isAdmin} /></Form.Item>
        <Form.Item name="localPort" label="本地服务端口" rules={[{ required: true, type: "number", min: 1, max: 65535, message: "请输入 1–65535 端口。" }]}><Input type="number" min={1} max={65535} placeholder="例如：27015" disabled={!isAdmin} /></Form.Item>
        <Form.Item name="transport" label="网络协议" rules={[{ required: true }]}><Select options={[{ value: "tcp", label: "TCP" }, { value: "udp", label: "UDP" }]} disabled={!isAdmin} /></Form.Item>
        {!isAdmin ? <Typography.Text type="secondary">自定义节点/端口映射仅管理员可操作；游戏 App 注册并绑定到账户的目标可由账户本人管理。</Typography.Text> : null}
      </> : <Form.Item name="transport" label="网络协议"><Select disabled options={[{ value: "tcp", label: "TCP · Minecraft Java" }]} /></Form.Item>}
      {!onlySelfManaged ? <Form.Item name="mode" label="联网方式" rules={[{ required: true }]}><Select options={[
        { value: "room-domain", label: "LFAA 房间域名" },
        { value: "self-managed", label: "自备穿透服务" },
        { value: "provider", label: "第三方 Provider · 暂无已核验接口", disabled: true }
       ]} /></Form.Item> : <Form.Item name="mode" hidden><Input /></Form.Item>}
      {(onlySelfManaged || routeMode === "self-managed") ? <Form.Item name="playerAddress" label="外部服务实际返回的玩家地址" rules={[{ required: true, message: "请输入外部服务提供的地址。" }]}><Input maxLength={280} placeholder="game.example.net:30000" /></Form.Item> : null}
    </div>
    <Form.Item name="sourceAppId" hidden><Input /></Form.Item>
    <div className="connectivity-form-footer">
      <Typography.Text type="secondary">{selectedTarget ? `目标 ${selectedTarget.nodeName} · 127.0.0.1:${selectedTarget.localPort} · ${selectedTarget.transport.toUpperCase()}` : selectedProtocol ? `协议 ${selectedProtocol.toUpperCase()}` : "所有目标都在回环地址映射，不接收任意内网主机地址。"}</Typography.Text>
      <Button type="primary" htmlType="submit" loading={busy} disabled={(!onlySelfManaged && routeMode === "room-domain" && !relayReady) || (kind === "minecraft" && !choices.length) || (kind === "custom" && !isAdmin)}>{onlySelfManaged ? "保存外部地址" : "创建路线"}</Button>
    </div>
  </Form>;
}

function RouteList({ routes, busy, onCopy, onDelete }: { routes: ConnectivityRoute[]; busy: boolean; onCopy: (address: string) => Promise<void>; onDelete: (route: ConnectivityRoute) => Promise<void> }) {
  if (!routes.length) return <Card className="connectivity-panel connectivity-empty"><Typography.Title level={4}>还没有路线</Typography.Title><Typography.Text type="secondary">创建后会显示协议、目标节点和实际玩家地址。</Typography.Text></Card>;
  return <section className="connectivity-route-list" aria-label="联机路线">
    {routes.map(route => <Card key={route.id} className="connectivity-route-card">
      <div className="connectivity-route-top"><div><Typography.Title level={5}>{route.name}</Typography.Title><Typography.Text type="secondary">{methodLabels[route.mode]} · {route.transport.toUpperCase()}</Typography.Text></div><Tag color={route.state === "connected" ? "green" : route.state === "failed" ? "red" : "blue"}>{stateLabels[route.state]}</Tag></div>
      <div className="connectivity-route-target"><Typography.Text type="secondary">本地目标</Typography.Text><code>{route.target.nodeId.slice(0, 8)} · {route.target.localHost}:{route.target.localPort}</code></div>
      <div className="connectivity-route-address"><Typography.Text type="secondary">玩家地址</Typography.Text><code>{route.playerAddress ?? "尚未分配"}</code><Space><Button size="small" disabled={!route.playerAddress} onClick={() => route.playerAddress && void onCopy(route.playerAddress)}>复制地址</Button><Button size="small" danger loading={busy} onClick={() => void onDelete(route)}>删除路线</Button></Space></div>
      {route.mode === "room-domain" ? <Typography.Text className="connectivity-route-footnote" type="secondary">“节点已接入 Relay”只表示隧道通道建立，不代表已从公网完成玩家连接。</Typography.Text> : null}
      {route.errorCode ? <Alert type="error" showIcon message="Relay 连接失败" description={route.errorCode} /> : null}
    </Card>)}
  </section>;
}

function ProviderCard({ provider, busy, onSave, onRemove, onQuery }: { provider: ConnectivityOverview["providers"][number]; busy: boolean; onSave: (id: string, token: string) => Promise<void>; onRemove: (id: string) => Promise<void>; onQuery: (id: string) => Promise<void> }) {
  const [token, setToken] = useState("");
  return <Card className="connectivity-provider-card"><div className="connectivity-route-top"><div><Typography.Title level={5}>{provider.name}</Typography.Title><Typography.Text type="secondary">{provider.transports.map(item => item.toUpperCase()).join(" / ")}</Typography.Text></div><Tag color={provider.configured ? "green" : "default"}>{provider.configured ? "令牌已保存" : "待配置"}</Tag></div>
    <Space.Compact block><Input.Password aria-label={`${provider.name} 访问令牌`} value={token} onChange={event => setToken(event.target.value)} autoComplete="new-password" placeholder="粘贴从官方控制台获取的访问令牌" maxLength={4096} /><Button type="primary" disabled={!token.trim()} loading={busy} onClick={() => void onSave(provider.id, token)}>加密保存</Button></Space.Compact>
    <Space><Button disabled={!provider.configured} loading={busy} onClick={() => void onQuery(provider.id)}>拉取官方节点</Button><Button disabled={!provider.configured} danger onClick={() => void onRemove(provider.id)}>移除令牌</Button></Space>
  </Card>;
}

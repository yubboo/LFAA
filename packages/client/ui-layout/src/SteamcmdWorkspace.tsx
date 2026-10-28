/** 功能：游戏服务内的 Steam 专用服务器管理面板。作用：通过认证 Connection 管理服务端记录与 SteamCMD 节点任务。关联文件：games/steamcmd、api/steamcmd-controller、host/daemon。 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert, Button, Checkbox, Input, InputNumber, Popconfirm, Select, Spin, Tag, Typography } from "antd";
import { createSteamcmdDstCluster, createSteamcmdServer, createSteamcmdServerTask, getErrorMessage, loadSteamcmdServers, loadSteamcmdSettings, loadSteamcmdTask, updateSteamcmdServer, type SteamcmdDstClusterInput, type SteamcmdServer, type SteamcmdServerInput, type SteamcmdSettingsNode, type SteamcmdTask, type User } from "lfaa-client-connection/src/api.js";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { setFileManagerLocation } from "lfaa-client-connection/src/file-manager-location.js";
import "./SteamcmdWorkspace.css";

const taskStatusLabel: Record<SteamcmdTask["status"], string> = { queued: "等待中", running: "执行中", succeeded: "已完成", failed: "失败" };
const serverStatusLabel: Record<SteamcmdServer["status"], string> = { unknown: "状态未确认", stopped: "已停止", running: "运行中", starting: "正在启动", stopping: "正在停止" };
const installStatusLabel: Record<SteamcmdServer["installationStatus"], string> = { unknown: "尚未安装", installing: "安装中", installed: "已安装", failed: "安装失败" };

interface ServerFormState {
  name: string;
  toolAppId: number | null;
  installDirectory: string;
  executablePath: string;
  launchArguments: string;
  stopCommand: string;
  stopTimeoutSeconds: number;
  eulaAccepted: boolean;
}

const emptyForm = (): ServerFormState => ({ name: "", toolAppId: null, installDirectory: "", executablePath: "", launchArguments: "", stopCommand: "", stopTimeoutSeconds: 60, eulaAccepted: false });
interface DstClusterFormState { clusterName: string; toolAppId: number | null; installDirectory: string; stopCommand: string; stopTimeoutSeconds: number; eulaAccepted: boolean; }
const emptyDstClusterForm = (): DstClusterFormState => ({ clusterName: "Cluster_1", toolAppId: null, installDirectory: "dst/server", stopCommand: "", stopTimeoutSeconds: 60, eulaAccepted: false });

type SteamcmdServerGroup = { id: string; kind: "single"; server: SteamcmdServer } | { id: string; kind: "dst"; clusterId: string; clusterName: string; servers: SteamcmdServer[] };
function groupSteamcmdServers(servers: SteamcmdServer[]): SteamcmdServerGroup[] {
  const groups = new Map<string, SteamcmdServer[]>();
  const result: SteamcmdServerGroup[] = [];
  for (const server of servers) {
    if (!server.dstClusterId || !server.dstClusterName || !server.dstShard) { result.push({ id: server.id, kind: "single", server }); continue; }
    const group = groups.get(server.dstClusterId) ?? [];
    group.push(server); groups.set(server.dstClusterId, group);
  }
  for (const [clusterId, members] of groups) {
    result.push({ id: clusterId, kind: "dst", clusterId, clusterName: members[0]!.dstClusterName!, servers: members.sort((left, right) => left.dstShard === right.dstShard ? 0 : left.dstShard === "Master" ? -1 : 1) });
  }
  return result;
}

export function SteamcmdWorkspace({ user, onNavigate }: { user: User; onNavigate: (path: string) => void }) {
  const [nodes, setNodes] = useState<SteamcmdSettingsNode[]>([]);
  const [nodeId, setNodeId] = useState(() => new URLSearchParams(window.location.search).get("target") ?? "");
  const [servers, setServers] = useState<SteamcmdServer[]>([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [task, setTask] = useState<SteamcmdTask | null>(null);
  const [form, setForm] = useState<ServerFormState>(() => emptyForm());
  const [dstForm, setDstForm] = useState<DstClusterFormState>(() => emptyDstClusterForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const selectedNode = useMemo(() => nodes.find(node => node.id === nodeId) ?? null, [nodes, nodeId]);
  const serverGroups = useMemo(() => groupSteamcmdServers(servers), [servers]);
  const taskActive = !!task && ["queued", "running"].includes(task.status);

  useEffect(() => {
    let active = true;
    void loadSteamcmdSettings().then(value => {
      if (!active) return;
      setNodes(value.nodes);
      setNodeId(current => current && value.nodes.some(node => node.id === current) ? current : value.nodes.find(node => node.status === "online")?.id ?? value.nodes[0]?.id ?? "");
    }).catch(reason => { if (active) setError(getErrorMessage(reason)); });
    return () => { active = false; };
  }, [user.id]);

  useEffect(() => {
    if (!nodeId) { setServers([]); return; }
    let active = true;
    setServerLoading(true);
    void loadSteamcmdServers(nodeId).then(value => { if (active) setServers(value.servers); })
      .catch(reason => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setServerLoading(false); });
    return () => { active = false; };
  }, [nodeId, revision, user.id]);

  useEffect(() => {
    if (!task || !["queued", "running"].includes(task.status)) return;
    let active = true;
    const controller = new AbortController();
    let poller: ReturnType<typeof createReadPoller> | undefined;
    const read = async () => {
      try {
        const value = await loadSteamcmdTask(task.id, controller.signal);
        if (!active) return;
        setTask(value.task);
        if (!["queued", "running"].includes(value.task.status)) {
          poller?.stop();
          setRevision(current => current + 1);
        }
      } catch (reason) { if (active) setError(getErrorMessage(reason)); }
    };
    poller = createReadPoller(read, 3000);
    return () => { active = false; controller.abort(); poller?.stop(); };
  }, [task?.id, user.id]);

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nodeId || !form.name.trim() || !form.toolAppId || !form.installDirectory.trim()) return;
    setBusy(true); setError(""); setNotice("");
    const input: SteamcmdServerInput = {
      nodeId, name: form.name.trim(), toolAppId: form.toolAppId, installDirectory: form.installDirectory.trim(),
      executablePath: form.executablePath.trim().replaceAll("\\", "/"),
      launchArguments: form.launchArguments.split(/\r?\n/u).map(value => value.trim()).filter(Boolean),
      stopCommand: form.stopCommand.trim(), stopTimeoutSeconds: form.stopTimeoutSeconds, eulaAccepted: form.eulaAccepted
    };
    try {
      if (editingId) await updateSteamcmdServer(editingId, input);
      else await createSteamcmdServer(input);
      setNotice(editingId ? "服务器配置已保存。" : "Steam 专用服务端记录已创建。接下来可以安装对应的 Tool AppID。");
      setEditingId(null); setForm(emptyForm()); setRevision(value => value + 1);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  };

  const runTask = async (server: SteamcmdServer, kind: "install-server" | "update-server" | "start-server" | "stop-server") => {
    setBusy(true); setError(""); setNotice("");
    try { setTask((await createSteamcmdServerTask(server.id, kind)).task); }
    catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  };

  const submitDstCluster = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nodeId || !dstForm.clusterName.trim() || !dstForm.toolAppId || !dstForm.installDirectory.trim() || !dstForm.stopCommand.trim() || !dstForm.eulaAccepted) return;
    setBusy(true); setError(""); setNotice("");
    const input: SteamcmdDstClusterInput = {
      nodeId, clusterName: dstForm.clusterName.trim(), toolAppId: dstForm.toolAppId, installDirectory: dstForm.installDirectory.trim(),
      stopCommand: dstForm.stopCommand.trim(), stopTimeoutSeconds: dstForm.stopTimeoutSeconds, eulaAccepted: true
    };
    try {
      await createSteamcmdDstCluster(input);
      setNotice(`饥荒集群 ${dstForm.clusterName} 已登记 Master 与 Caves。请先安装服务端，再打开集群文件夹上传配置。`);
      setDstForm(emptyDstClusterForm()); setRevision(value => value + 1);
      setEditingId(null); setTask(null);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setBusy(false); }
  };

  const openDstConfiguration = (server: SteamcmdServer) => {
    if (!server.dstClusterId || !server.dstClusterName) return;
    setFileManagerLocation(user.id, `.lfaa-library/game-storage/${server.nodeId}/steamcmd/dst-clusters/${server.dstClusterId}/DoNotStarveTogether/${server.dstClusterName}`);
    onNavigate("/files");
  };

  const editServer = (server: SteamcmdServer) => {
    setEditingId(server.id);
    setForm({ name: server.name, toolAppId: server.toolAppId, installDirectory: server.installDirectory, executablePath: server.executablePath, launchArguments: server.launchArguments.join("\n"), stopCommand: server.stopCommand, stopTimeoutSeconds: server.stopTimeoutSeconds, eulaAccepted: server.eulaAccepted });
    setNotice(""); setError("");
  };

  const nodeOptions = nodes.map(node => ({ value: node.id, label: `${node.displayName} · ${node.status === "online" ? "在线" : "离线"}` }));
  const canEdit = user.role !== "member" && !!selectedNode && selectedNode.status === "online" && !busy && !taskActive;
  const gamePath = selectedNode?.storage.gameDirectory ?? "games/steamcmd";

  return <section className="game-library steamcmd-workspace" aria-labelledby="game-library-heading">
    <header className="game-library__header steamcmd-workspace__header">
      <div>
        <Typography.Title id="game-library-heading" level={1}>Steam 游戏服务器</Typography.Title>
        <Typography.Paragraph>按 Steam 已发布的 Dedicated Server Tool AppID 部署和更新专用服务端；客户端商店 AppID 不一定能用于匿名下载。</Typography.Paragraph>
      </div>
      <div className="steamcmd-workspace__node-picker">
        <label htmlFor="steamcmd-node-select">目标设备</label>
        <Select id="steamcmd-node-select" aria-label="Steam 游戏服务器目标设备" value={nodeId || undefined} options={nodeOptions} onChange={setNodeId} placeholder="选择 Windows x64 节点" disabled={!nodeOptions.length} />
        <Button onClick={() => setRevision(value => value + 1)} disabled={serverLoading || !nodeId}>刷新状态</Button>
      </div>
    </header>

    {error ? <Alert className="steamcmd-workspace__alert" type="error" showIcon message={error} /> : null}
    {notice ? <Alert className="steamcmd-workspace__alert" type="success" showIcon message={notice} /> : null}
    {user.role === "member" ? <Alert type="warning" showIcon message="Steam 游戏服务器的节点与安装管理需要管理员账户。" /> : null}
    {!nodes.length && !error ? <Alert type="info" showIcon message="尚未发现 Windows x64 Daemon 节点。启动或连接一个节点后，可在这里管理 Steam 专用服务端。" /> : null}
    {selectedNode && !selectedNode.steamcmdInstalled ? <Alert className="steamcmd-workspace__alert" type="warning" showIcon message="此设备尚未验证 SteamCMD" description={<Button type="link" onClick={() => onNavigate(`/games/environments?target=${encodeURIComponent(selectedNode.id)}`)}>前往运行环境安装或校验 SteamCMD</Button>} /> : null}
    {task ? <section className="steamcmd-workspace__task" aria-label="Steam 游戏服务器任务" role="status">
      <div><strong>{task.message}</strong><span>{taskStatusLabel[task.status]}{task.status === "running" ? ` · ${task.progress}%` : ""}</span></div>
      {task.result && typeof task.result === "object" && "forced" in task.result && task.result.forced ? <p>服务器未响应停服指令，Daemon 已结束进程树；游戏存档完整性未确认。</p> : null}
    </section> : null}

    <div className="steamcmd-workspace__layout">
      <section className="steamcmd-workspace__servers" aria-label="Steam 游戏服务器列表">
        <div className="steamcmd-workspace__section-title"><Typography.Title level={2}>服务器</Typography.Title><Tag>{servers.length} 项</Tag></div>
        {serverLoading ? <div className="steamcmd-workspace__loading"><Spin /> 正在读取真实节点状态…</div> : null}
        {!serverLoading && !servers.length ? <div className="steamcmd-workspace__empty"><Typography.Title level={3}>还没有 Steam 专用服务端</Typography.Title><p>填写右侧配置并提供 Steamworks 发布的 Dedicated Server Tool AppID，即可安装或更新该游戏的服务端文件。</p></div> : null}
        <div className="steamcmd-workspace__server-list">
          {serverGroups.map(group => {
            if (group.kind === "dst") {
              const master = group.servers[0]!;
              const active = taskActive && task?.nodeId === master.nodeId;
              const installed = group.servers.every(server => server.installationStatus === "installed");
              const safeToInstall = group.servers.every(server => server.status === "stopped"
                || server.status === "unknown" && server.processId === null && (server.installationStatus === "unknown" || server.installationStatus === "failed"));
              const sharedDataPath = `${gamePath.replace(/[\\/]$/u, "")}/dst-clusters/${group.clusterId}`;
              return <article className="steamcmd-workspace__server steamcmd-workspace__dst-cluster" key={group.id}>
                <div className="steamcmd-workspace__server-heading"><div><Typography.Title level={3}>饥荒联机版 · {group.clusterName}</Typography.Title><p>Master + Caves · Dedicated Server Tool AppID · <code>{master.toolAppId}</code></p></div><div className="steamcmd-workspace__tags"><Tag color={installed ? "green" : master.installationStatus === "failed" ? "red" : "default"}>{installStatusLabel[master.installationStatus]}</Tag></div></div>
                <p className="steamcmd-workspace__path">服务端：{gamePath.replace(/[\\/]$/u, "")}/{master.installDirectory}</p>
                <p className="steamcmd-workspace__path">集群数据：{sharedDataPath}/DoNotStarveTogether/{group.clusterName}</p>
                <div className="game-library__actions">
                  <Button type={installed ? "default" : "primary"} disabled={!canEdit || active || !selectedNode?.steamcmdInstalled || !safeToInstall} onClick={() => void runTask(master, installed ? "update-server" : "install-server")}>{installed ? "更新共用服务端文件" : "安装饥荒服务端"}</Button>
                  <Button disabled={!installed || !canEdit} onClick={() => openDstConfiguration(master)}>配置集群文件</Button>
                </div>
                {!installed ? <p className="steamcmd-workspace__hint">安装成功后，点击“配置集群文件”，通过节点文件管理器上传 `cluster.ini`、`cluster_token.txt`、`Master/server.ini` 和 `Caves/server.ini`。令牌不会进入服务端参数。</p> : null}
                <div className="steamcmd-workspace__dst-shards">
                  {group.servers.map(server => {
                    const readyToStart = server.installationStatus === "installed" && server.executablePath && server.stopCommand && server.eulaAccepted && server.status === "stopped";
                    return <section className="steamcmd-workspace__dst-shard" key={server.id} aria-label={`${server.dstShard} 分片`}>
                      <div className="steamcmd-workspace__server-heading"><Typography.Title level={4}>{server.dstShard}</Typography.Title><div className="steamcmd-workspace__tags"><Tag color={server.status === "running" ? "green" : server.status === "unknown" ? "orange" : "default"}>{serverStatusLabel[server.status]}</Tag></div></div>
                      {server.processId ? <p>Daemon 进程 ID：{server.processId}</p> : null}
                      <div className="game-library__actions">
                        {server.status === "running" ? <Popconfirm title={`停止 ${server.dstShard} 分片？`} description={`${server.stopTimeoutSeconds} 秒未收到安全退出确认后，Daemon 将结束该进程树；存档完整性未确认。`} okText="发送停服指令" cancelText="继续运行" onConfirm={() => void runTask(server, "stop-server")}><Button danger disabled={!canEdit || active || !server.stopCommand}>停止</Button></Popconfirm>
                          : <Button type="primary" disabled={!canEdit || active || !selectedNode?.steamcmdInstalled || !readyToStart} onClick={() => void runTask(server, "start-server")}>启动 {server.dstShard}</Button>}
                      </div>
                    </section>;
                  })}
                </div>
              </article>;
            }
            const { server } = group;
            const active = taskActive && task?.nodeId === server.nodeId;
            const readyToStart = server.installationStatus === "installed" && server.executablePath && server.stopCommand && server.eulaAccepted && server.status === "stopped";
            return <article className="steamcmd-workspace__server" key={server.id}>
              <div className="steamcmd-workspace__server-heading"><div><Typography.Title level={3}>{server.name}</Typography.Title><p>Dedicated Server Tool AppID · <code>{server.toolAppId}</code></p></div><div className="steamcmd-workspace__tags"><Tag color={server.installationStatus === "installed" ? "green" : server.installationStatus === "failed" ? "red" : "default"}>{installStatusLabel[server.installationStatus]}</Tag><Tag color={server.status === "running" ? "green" : server.status === "unknown" ? "orange" : "default"}>{serverStatusLabel[server.status]}</Tag></div></div>
              <p className="steamcmd-workspace__path">{gamePath.replace(/[\\/]$/u, "")}/{server.installDirectory}</p>
              {server.processId ? <p>Daemon 进程 ID：{server.processId}</p> : null}
              <div className="game-library__actions">
                {server.installationStatus === "installed" ? <Button disabled={!canEdit || active || server.status === "running" || server.status === "starting" || server.status === "stopping" || !selectedNode?.steamcmdInstalled} onClick={() => void runTask(server, "update-server")}>更新服务端</Button>
                  : <Button type="primary" disabled={!canEdit || active || !selectedNode?.steamcmdInstalled} onClick={() => void runTask(server, "install-server")}>安装服务端</Button>}
                <Button onClick={() => editServer(server)} disabled={!canEdit || server.status !== "stopped" && !(server.status === "unknown" && server.installationStatus === "unknown" && server.processId === null)}>配置</Button>
                {server.status === "running" ? <Popconfirm title={`停止 ${server.name}？`} description={`将发送“${server.stopCommand || "未配置停服指令"}”，${server.stopTimeoutSeconds} 秒无响应后会结束进程树；未保存的游戏数据可能丢失。`} okText="发送停服指令" cancelText="继续运行" onConfirm={() => void runTask(server, "stop-server")}><Button danger disabled={!canEdit || active || !server.stopCommand}>停止</Button></Popconfirm>
                  : <Button type="primary" disabled={!canEdit || active || !selectedNode?.steamcmdInstalled || !readyToStart} onClick={() => void runTask(server, "start-server")}>启动</Button>}
              </div>
              {!server.executablePath || !server.stopCommand ? <p className="steamcmd-workspace__hint">启动前需配置安装目录中的 .exe、游戏启动参数和控制台停服指令。</p> : null}
            </article>;
          })}
        </div>
      </section>

      <section className="steamcmd-workspace__form-card" aria-label={editingId ? "修改 Steam 服务端配置" : "添加 Steam 服务端"}>
        <div className="steamcmd-workspace__section-title"><Typography.Title level={2}>{editingId ? "服务端配置" : "添加服务端"}</Typography.Title>{editingId ? <Button type="link" onClick={() => { setEditingId(null); setForm(emptyForm()); }}>新建</Button> : null}</div>
        <form className="steamcmd-workspace__form" onSubmit={submitForm}>
          <label>服务器名称<Input required maxLength={80} value={form.name} onChange={event => setForm(value => ({ ...value, name: event.target.value }))} placeholder="例如 Counter-Strike Dedicated Server" /></label>
          <label>Dedicated Server Tool AppID<InputNumber required min={1} max={2147483647} precision={0} value={form.toolAppId} onChange={value => setForm(current => ({ ...current, toolAppId: value }))} placeholder="Steamworks 发布的工具 AppID" /></label>
          <label>游戏目录下的安装子目录<Input required maxLength={512} value={form.installDirectory} onChange={event => setForm(value => ({ ...value, installDirectory: event.target.value }))} placeholder="例如 servers/cs2" /></label>
          <label>启动程序相对路径<Input maxLength={1024} value={form.executablePath} onChange={event => setForm(value => ({ ...value, executablePath: event.target.value }))} placeholder="安装后填写，例如 srcds.exe" /></label>
          <label className="steamcmd-workspace__wide">启动参数（每行一个参数；不经过 Shell；不要放密码、令牌或密钥）<Input.TextArea rows={3} maxLength={8192} value={form.launchArguments} onChange={event => setForm(value => ({ ...value, launchArguments: event.target.value }))} placeholder={"例如：\n-dedicated\n-port\n27015"} /></label>
          <label>控制台停服指令<Input maxLength={120} value={form.stopCommand} onChange={event => setForm(value => ({ ...value, stopCommand: event.target.value }))} placeholder="按此游戏服务端的文档填写，例如 quit" /></label>
          <label>停服等待时间（秒）<InputNumber min={5} max={300} precision={0} value={form.stopTimeoutSeconds} onChange={value => setForm(current => ({ ...current, stopTimeoutSeconds: value ?? 60 }))} /></label>
          <Checkbox checked={form.eulaAccepted} onChange={event => setForm(value => ({ ...value, eulaAccepted: event.target.checked }))}>我已阅读并接受此服务端的软件许可与 EULA</Checkbox>
          <Button className="steamcmd-workspace__submit" type="primary" htmlType="submit" disabled={!canEdit || !form.name.trim() || !form.toolAppId || !form.installDirectory.trim()} loading={busy}>{editingId ? "保存配置" : "创建服务端记录"}</Button>
        </form>
        <p className="steamcmd-workspace__hint">Steam 官方按 Dedicated Server Tool AppID 分发服务端；安装目录使用设置中的游戏数据目录。不能用客户端商店 AppID 推断匿名下载一定可用。<a href="https://partner.steamgames.com/doc/sdk/uploading/distributing_gs?l=english" target="_blank" rel="noreferrer">Steamworks 分发说明</a></p>
      </section>
    </div>

    <section className="steamcmd-workspace__form-card steamcmd-workspace__dst-card" aria-label="创建饥荒联机版集群">
      <div className="steamcmd-workspace__section-title"><Typography.Title level={2}>饥荒联机版本地集群</Typography.Title></div>
      <p className="steamcmd-workspace__hint">向导会登记 Master 与 Caves 两个分片，共用一份 SteamCMD 服务端文件。安装完成后，从节点文件管理器上传集群配置和令牌。</p>
      <form className="steamcmd-workspace__form steamcmd-workspace__dst-form" onSubmit={submitDstCluster}>
        <label>集群目录名<Input required maxLength={32} pattern="[A-Za-z0-9_-]{1,32}" value={dstForm.clusterName} onChange={event => setDstForm(value => ({ ...value, clusterName: event.target.value }))} placeholder="例如 Cluster_1" /></label>
        <label>Dedicated Server Tool AppID<InputNumber required min={1} max={2147483647} precision={0} value={dstForm.toolAppId} onChange={value => setDstForm(current => ({ ...current, toolAppId: value }))} placeholder="Steamworks 发布的专服 Tool AppID" /></label>
        <label>游戏目录下的安装子目录<Input required maxLength={512} value={dstForm.installDirectory} onChange={event => setDstForm(value => ({ ...value, installDirectory: event.target.value }))} placeholder="例如 dst/server" /></label>
        <label>控制台停服指令<Input required maxLength={120} value={dstForm.stopCommand} onChange={event => setDstForm(value => ({ ...value, stopCommand: event.target.value }))} placeholder="按 Klei 服务器文档确认后填写" /></label>
        <label>停服等待时间（秒）<InputNumber min={5} max={300} precision={0} value={dstForm.stopTimeoutSeconds} onChange={value => setDstForm(current => ({ ...current, stopTimeoutSeconds: value ?? 60 }))} /></label>
        <Checkbox checked={dstForm.eulaAccepted} onChange={event => setDstForm(value => ({ ...value, eulaAccepted: event.target.checked }))}>我已阅读并接受饥荒联机版专用服务器许可和 EULA</Checkbox>
        <Button className="steamcmd-workspace__submit" type="primary" htmlType="submit" disabled={!canEdit || !selectedNode?.steamcmdInstalled || !dstForm.clusterName.trim() || !dstForm.toolAppId || !dstForm.installDirectory.trim() || !dstForm.stopCommand.trim() || !dstForm.eulaAccepted} loading={busy}>创建 Master + Caves 集群</Button>
      </form>
      <p className="steamcmd-workspace__hint">请填写 Steamworks 发布的专用服务端 Tool AppID；客户端商店 AppID 不能替代它。Klei 官方命令行说明确认 Windows x64 启动文件和 Master/Caves 参数，但未给出此处可预填的 Tool AppID 数值或停服命令，因此向导要求你核实后填写。<a href="https://support.klei.com/hc/en-us/articles/360029556192-Dedicated-Server-Command-Line-Options-Guide" target="_blank" rel="noreferrer">Klei 官方命令行说明</a></p>
    </section>
  </section>;
}

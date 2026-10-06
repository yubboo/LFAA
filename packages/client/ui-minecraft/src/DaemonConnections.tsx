/**
 * 功能：管理真实远程 Daemon 的连接身份。
 * 作用：管理员生成/轮换受保护的节点连接文件，并可撤销已登记身份；浏览器只获取公开身份摘要。
 * 关联文件：connection/src/api.ts、host/daemon/src/connection-config.mjs、MinecraftWorkspace.tsx。
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Input, Popconfirm, Space, Tag, Typography } from "antd";
import { getErrorMessage, issueDaemonConnection, loadDaemonCredentials, revokeDaemonConnection, type DaemonCredentialSummary } from "lfaa-client-connection/src/api.js";
export function DaemonConnections() {
  const [nodes, setNodes] = useState<DaemonCredentialSummary[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => { setNodes((await loadDaemonCredentials()).nodes); }, []);
  useEffect(() => { void refresh().catch(failure => setError(getErrorMessage(failure))); }, [refresh]);
  const issue = async (node?: DaemonCredentialSummary) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const target = new URL(url);
      if (target.protocol !== "https:" || target.username || target.password || target.search || target.hash || !["/", "/api", "/api/"].includes(target.pathname)) throw new Error("请输入远程节点可访问的 HTTPS 控制端地址，不能包含凭据或查询参数。");
      const connection = await issueDaemonConnection(node?.displayName ?? name, target.origin, node?.nodeId);
      setNotice(`连接文件已在控制端受保护目录生成。使用 lfaa daemon export --node ${connection.nodeId} --output-file 文件路径 导出；此接口未向浏览器返回密钥。轮换后旧连接立即失效。`);
      await refresh();
    } catch (failure) { setError(getErrorMessage(failure)); } finally { setBusy(false); }
  };
  const revoke = async (nodeId: string) => {
    setBusy(true); setError("");
    try { await revokeDaemonConnection(nodeId); await refresh(); }
    catch (failure) { setError(getErrorMessage(failure)); } finally { setBusy(false); }
  };
  return <Card className="minecraft-card">
    <Typography.Title level={4}>远程节点连接</Typography.Title>
    <Typography.Paragraph type="secondary">本机节点随 Web 启动器托管；远程 Windows x64 节点使用独立连接文件。控制端须配置 HTTPS，远程节点不会替换成控制机器执行。</Typography.Paragraph>
    <Space direction="vertical" style={{ width: "100%" }}>
      <Input aria-label="控制端 HTTPS 地址" value={url} placeholder="控制端 HTTPS 地址" onChange={event => setUrl(event.target.value)} disabled={busy} />
      <Space.Compact block><Input aria-label="远程节点名称" value={name} maxLength={80} placeholder="远程节点名称" onChange={event => setName(event.target.value)} disabled={busy} /><Button type="primary" disabled={busy || !name.trim() || !url.trim()} onClick={() => void issue()}>生成连接文件</Button></Space.Compact>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {notice ? <Alert type="success" showIcon message={notice} /> : null}
      {nodes.map(node => <Space wrap key={node.nodeId}>
        <Typography.Text>{node.displayName}</Typography.Text><Typography.Text code>{node.nodeId}</Typography.Text><Tag>{node.revoked ? "已撤销" : "已签发"}</Tag>
        <Button disabled={busy || !url.trim()} onClick={() => void issue(node)}>轮换连接文件</Button>
        <Popconfirm getPopupContainer={trigger => trigger.closest<HTMLElement>(".workbench-shell") ?? trigger.parentElement ?? trigger} title="撤销此节点连接？" description="将拒绝后续连接和任务回报；已经运行的操作不能据此确认已停止。" onConfirm={() => revoke(node.nodeId)}><Button danger disabled={busy || node.revoked}>撤销</Button></Popconfirm>
      </Space>)}
      <Typography.Paragraph>在控制端 OS 账户下导出连接文件，通过受信任通道传给目标节点。在目标节点运行 <Typography.Text code>lfaa daemon configure --connection-file 文件路径</Typography.Text>，再运行 <Typography.Text code>lfaa daemon</Typography.Text>。导入后删除传输副本。</Typography.Paragraph>
    </Space>
  </Card>;
}

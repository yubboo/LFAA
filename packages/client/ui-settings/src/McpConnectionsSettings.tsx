/** 功能：呈现设置中心的账户 MCP 服务配置。作用：复用 plugins.mcpServers 权威设置和原自动保存入口。关联文件：SettingsPage、ManagedPluginsSettings、Settings Owner。 */
import { Alert, Button, Input, Select, Space, Typography } from "antd";
import type { UserSettings } from "lfaa-client-connection/src/api.js";
import { SettingGroup, SettingRow, SettingsSwitch } from "lfaa-client-ui-primitives/src/settings-controls.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

const REA_PACKAGE_VERSION = "6.7.0";
const REA_SERVER_ID = "rea";

const mcpApplicationOptions = [
  { value: "workspace", label: "通用工作区" },
  { value: "minecraft", label: "Minecraft" },
  { value: "steamcmd", label: "SteamCMD 开服" },
  { value: "writing", label: "写作工作区" }
] as const;

export function McpConnectionsSettings({ settings, onChange, searchQuery = "" }: {
  settings: UserSettings;
  onChange: (plugins: UserSettings["plugins"]) => void;
  searchQuery?: string;
}) {
  const servers = settings.plugins.mcpServers;
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("zh-CN");
  const visibleServers = normalizedQuery ? servers.filter(server => [
    server.name,
    server.transport === "stdio" ? server.command : server.url,
    ...server.applicationIds
  ].some(value => value.toLocaleLowerCase("zh-CN").includes(normalizedQuery))) : servers;

  function update(patch: Partial<UserSettings["plugins"]>): void {
    onChange({ ...settings.plugins, ...patch });
  }

  function commitServer(id: string, next: UserSettings["plugins"]["mcpServers"][number]): void {
    update({ mcpServers: servers.map(server => server.id === id ? next : server) });
  }

  function addReaServer(): void {
    if (servers.length >= 16 || servers.some(server => server.id === REA_SERVER_ID)) return;
    update({ mcpServers: [...servers, {
      id: REA_SERVER_ID,
      name: `REA ${REA_PACKAGE_VERSION}`,
      transport: "stdio",
      command: "cmd.exe",
      args: ["/d", "/c", `npx -y rea-agents@${REA_PACKAGE_VERSION} mcp`],
      enabled: true,
      applicationIds: ["workspace"],
      computerUse: false
    }] });
  }

  return <>
    <SettingGroup title="MCP 服务">
      <SettingRow title="Agent 扩展总开关" description="关闭后，账户 Skills、提示词、Tools 和 MCP 服务都不会加入 Agent 运行时。每项 MCP 的开关仍保留原值。" status={settings.plugins.enabled ? "已开启" : "已关闭"}>
        <SettingsSwitch label="允许 Agent 使用扩展" checked={settings.plugins.enabled} onChange={() => update({ enabled: !settings.plugins.enabled })} />
      </SettingRow>
      {servers.length === 0 ? <div className="settings-profile-plugins__state" role="status">
        <WorkbenchIcon name="browser" size={20} />
        <strong>尚未配置 MCP 服务</strong>
        <span>添加一个已运行的 HTTP 服务，或配置允许在本机启动的 stdio 服务。</span>
      </div> : null}
      {servers.length > 0 && visibleServers.length === 0 ? <div className="settings-profile-plugins__state" role="status">没有符合当前搜索的 MCP 服务。</div> : null}
      {visibleServers.map(server => {
        const commit = (next: typeof server) => commitServer(server.id, next);
        const change = (patch: Partial<typeof server>) => commit({ ...server, ...patch } as typeof server);
        const transport = server.transport ?? "streamable-http";
        const stdioServer = server.transport === "stdio" ? server : null;
        const manifestState = server.manifestSha256 ? `已固定工具合同 SHA-256 ${server.manifestSha256.slice(0, 16)}` : "尚未固定工具合同";
        const description = (transport === "stdio"
          ? "本机 MCP 程序在 LFAA Control Plane 所在机器启动，配置只能启动用户填写的可执行文件和参数，不经过 Shell；远程生产控制端拒绝启动。"
          : "连接已运行的 Streamable HTTP 服务。地址不能包含密钥；需要认证的服务须先配置本机代理。")
          + ` 只有选择的应用会向模型提供此服务的工具，工具调用仍遵循当前权限模式。${manifestState}。`;
        return <SettingRow key={server.id} title={server.name || "MCP 服务"} description={description} status={server.enabled ? "已启用" : "已停用"}>
          <Space direction="vertical" className="settings-profile-mcp-row__fields">
            <Input aria-label="MCP 服务名称" value={server.name} maxLength={80} onChange={event => change({ name: event.target.value })} />
            <Select aria-label="MCP 传输方式" value={transport} options={[{ value: "streamable-http", label: "Streamable HTTP" }, { value: "stdio", label: "本机 stdio" }]} onChange={(value: "streamable-http" | "stdio") => {
              const base = { id: server.id, name: server.name, enabled: server.enabled, applicationIds: server.applicationIds };
              commit(value === "stdio"
                ? { ...base, transport: "stdio", command: "", args: [], computerUse: false }
                : { ...base, transport: "streamable-http", url: "" });
            }} />
            {stdioServer ? <>
              <Input aria-label="MCP 可执行文件" value={stdioServer.command} maxLength={1024} placeholder="open-computer-use.exe 或 node.exe" onChange={event => change({ command: event.target.value } as Partial<typeof server>)} />
              <Input.TextArea aria-label="MCP 参数（每行一个）" value={stdioServer.args.join("\n")} autoSize={{ minRows: 2, maxRows: 6 }} onChange={event => change({ args: event.target.value ? event.target.value.split(/\r?\n/u).slice(0, 32) : [] } as Partial<typeof server>)} placeholder={"mcp\n或 node 脚本路径和 mcp"} />
              <SettingsSwitch label="这是本机 Computer-Use 服务" checked={stdioServer.computerUse === true} onChange={() => change({ computerUse: stdioServer.computerUse !== true } as Partial<typeof server>)} />
              {stdioServer.computerUse === true ? <Typography.Text type={settings.computerControl.enabled ? "secondary" : "warning"}>{settings.computerControl.enabled ? "还需同时开启设置中心的“电脑操控”，Agent 才会发现和调用此服务。" : "电脑操控当前关闭；此 MCP 不会启动或向 Agent 暴露工具。"}</Typography.Text> : null}
            </> : <Input aria-label="MCP 服务地址" value={server.transport === "stdio" ? "" : server.url} maxLength={1024} placeholder="http://127.0.0.1:端口/mcp" onChange={event => change({ transport: "streamable-http", url: event.target.value })} />}
            <Select mode="multiple" aria-label="MCP 可用应用范围" value={server.applicationIds} options={[...mcpApplicationOptions]} onChange={(values: string[]) => change({ applicationIds: values.filter((value): value is typeof mcpApplicationOptions[number]["value"] => mcpApplicationOptions.some(option => option.value === value)) })} placeholder="选择可用应用" />
            <Space>
              <SettingsSwitch label={`连接 ${server.name || "MCP 服务"}`} checked={server.enabled} onChange={() => change({ enabled: !server.enabled })} />
              <Button onClick={() => update({ mcpServers: servers.filter(item => item.id !== server.id) })}>移除</Button>
            </Space>
          </Space>
        </SettingRow>;
      })}
      <Space wrap>
        <Button type="primary" disabled={servers.length >= 16 || servers.some(server => server.id === REA_SERVER_ID)} onClick={addReaServer}>添加官方 REA {REA_PACKAGE_VERSION}（Windows）</Button>
        <Button disabled={servers.length >= 16} onClick={() => update({ mcpServers: [...servers, { id: `m${crypto.randomUUID().slice(0, 12)}`, name: "", transport: "streamable-http", url: "", enabled: false, applicationIds: ["workspace"] }] })}>添加 MCP 服务</Button>
      </Space>
    </SettingGroup>
    <Alert className="settings-inline-alert" type="warning" showIcon message={`MCP 调用使用账户当前权限模式。官方 REA 预设固定 rea-agents@${REA_PACKAGE_VERSION}，只写入 workspace App；启用并运行 AI Work 后，本机 Windows 控制端会通过 npx 启动，首次可能从 npm 获取该版本。macOS/Linux 请按主机平台改为 npx 与对应参数。stdio 只允许本机桌面、开发或本机 CLI 控制端启动；远程生产控制端不会代替你的电脑启动。标记为 Computer-Use 的服务还受“电脑操控”账户开关限制。`} />
  </>;
}

import { useEffect, useState, type ChangeEvent } from "react";
import { Alert, Button, Checkbox, Input, Popconfirm, Space, Tag, Typography, message } from "antd";
import { SettingGroup, SettingRow } from "lfaa-client-ui-primitives/src/settings-controls.js";
import { createAccountSnapshot, deleteAccountSnapshot, downloadAccountSnapshot, exportCurrentAccountArchive, loadAccountSnapshots, previewAccountArchiveFile, previewAccountSnapshotRestore, restoreAccountArchiveFile, restoreAccountSnapshot, type AccountArchivePreview, type AccountArchiveRestoreResult, type AccountArchiveSelection, type AccountSnapshotSummary } from "lfaa-client-connection/src/api.js";

type RestoreSource = { kind: "snapshot"; id: string } | { kind: "file"; file: File };
const emptySelection: AccountArchiveSelection = { settings: false, memories: false, sessions: false };

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; anchor.style.display = "none";
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function AccountSnapshotsSettings({ mode }: { mode: "import" | "snapshots" }): JSX.Element {
  const [snapshots, setSnapshots] = useState<AccountSnapshotSummary[]>([]);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<AccountArchivePreview | null>(null);
  const [source, setSource] = useState<RestoreSource | null>(null);
  const [selection, setSelection] = useState<AccountArchiveSelection>(emptySelection);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AccountArchiveRestoreResult | null>(null);

  const refresh = async () => {
    const response = await loadAccountSnapshots();
    setSnapshots(response.snapshots);
  };
  useEffect(() => { void refresh().catch(error => message.error(error instanceof Error ? error.message : "读取账户快照失败。")); }, []);

  const clearPreview = () => { setPreview(null); setSource(null); setSelection(emptySelection); setResult(null); };
  const prepareSnapshot = async (snapshot: AccountSnapshotSummary) => {
    setBusy(true); setResult(null);
    try {
      const response = await previewAccountSnapshotRestore(snapshot.id);
      setPreview(response.preview); setSource({ kind: "snapshot", id: snapshot.id }); setSelection(emptySelection);
      message.success(`已核验快照“${snapshot.name}”，请检查冲突和选择恢复范围。`);
    } catch (error) { message.error(error instanceof Error ? error.message : "快照预览失败。"); }
    finally { setBusy(false); }
  };

  const prepareFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!chosen) return;
    clearPreview(); setBusy(true);
    try {
      const response = await previewAccountArchiveFile(chosen);
      setPreview(response.preview); setSource({ kind: "file", file: chosen });
      message.success("归档完整性、版本和数据范围已核验；尚未写入资料。请选择恢复范围。 ");
    } catch (error) { message.error(error instanceof Error ? error.message : "归档预览失败。"); }
    finally { setBusy(false); }
  };

  const createSnapshot = async () => {
    const value = name.trim();
    if (!value) { message.info("请先填写快照名称。"); return; }
    setBusy(true);
    try { const response = await createAccountSnapshot(value); setName(""); await refresh(); message.success(`快照已创建并回读：${response.snapshot.name}`); }
    catch (error) { message.error(error instanceof Error ? error.message : "创建快照失败。"); }
    finally { setBusy(false); }
  };

  const downloadSnapshot = async (snapshot: AccountSnapshotSummary) => {
    setBusy(true);
    try { saveBlob(await downloadAccountSnapshot(snapshot.id), `lfaa-account-${snapshot.id}.lfaa-snapshot`); }
    catch (error) { message.error(error instanceof Error ? error.message : "下载快照失败。"); }
    finally { setBusy(false); }
  };

  const exportCurrent = async () => {
    setBusy(true);
    try { saveBlob(await exportCurrentAccountArchive(), `lfaa-account-${new Date().toISOString().slice(0, 10)}.lfaa-snapshot`); message.success("账户资料归档已生成。"); }
    catch (error) { message.error(error instanceof Error ? error.message : "导出账户资料失败。"); }
    finally { setBusy(false); }
  };

  const deleteSnapshot = async (snapshot: AccountSnapshotSummary) => {
    setBusy(true);
    try { await deleteAccountSnapshot(snapshot.id); await refresh(); if (source?.kind === "snapshot" && source.id === snapshot.id) clearPreview(); message.success("快照已删除；原账户资料未改变。"); }
    catch (error) { message.error(error instanceof Error ? error.message : "删除快照失败。"); }
    finally { setBusy(false); }
  };

  const restore = async () => {
    if (!source || !Object.values(selection).some(Boolean)) return;
    setBusy(true); setResult(null);
    try {
      const response = source.kind === "snapshot"
        ? await restoreAccountSnapshot(source.id, selection)
        : await restoreAccountArchiveFile(source.file, selection);
      setResult(response.result);
      await refresh();
      message.success("所选账户资料已恢复并由 Owner 回读确认。");
    } catch (error) { message.error(error instanceof Error ? error.message : "账户资料恢复失败。"); }
    finally { setBusy(false); }
  };

  const title = mode === "import" ? "导入与导出" : "应用快照";
  return <section className="settings-content settings-content--account-snapshots" role="tabpanel" tabIndex={0}>
    <header className="settings-content__heading"><div><span className="settings-eyebrow">个人资料</span><Typography.Title level={2}>{title}</Typography.Title><Typography.Paragraph>{mode === "import" ? "换电脑时迁移账户设置、长期记忆、对话、Agent 安全活动摘要、分支检查点和会话附件。导入的会话默认归档，恢复后可继续对话；项目文件需另行迁移并重新关联。" : "本机快照保留可移植设置、长期记忆与公开对话；跨电脑迁移请在“导入与导出”生成完整迁移包。"}所有恢复先预览并选择范围。</Typography.Paragraph></div></header>

    <Alert className="settings-snapshot-info" type="info" showIcon message="迁移边界" description="完整迁移包只带公开会话内容、安全活动摘要、记忆检查点和被会话引用的附件；不含权限模式、密码/恢复凭据、Provider 密钥、插件/MCP 连接、浏览器或电脑访问权限、模型请求/工具原始日志、用量、运行中任务、本机路径和项目文件。新电脑需重新登录并配置密钥；另行迁移项目后再重新关联。旧 v1 快照仍可导入，但没有附件字节和 Agent 检查点。" />

    {mode === "import" ? <SettingGroup title="账户资料归档">
      <SettingRow title="导出当前账户" description="在旧电脑导出 .lfaa-snapshot 文件并复制到新电脑；包含会话附件和可恢复的 Agent 上下文。附件原始总量上限 200 MiB，迁移包还受压缩/解压容量限制。">
        <Button loading={busy} onClick={() => void exportCurrent()}>导出账户资料</Button>
      </SettingRow>
      <SettingRow title="导入归档" description="在新电脑登录后选择迁移文件；会话以归档状态导入，可恢复后继续对话。预览不会写入数据。">
        <label className="settings-snapshot-file"><span>选择快照文件</span><input type="file" accept=".lfaa-snapshot,application/vnd.lfaa.account-snapshot" disabled={busy} onChange={event => void prepareFile(event)} /></label>
      </SettingRow>
    </SettingGroup> : null}

    {mode === "snapshots" ? <SettingGroup title="本机账户快照">
      <SettingRow title="创建快照" description="保存当前账户的可移植设置、会话记忆和公开对话文本；最多保存 50 个。">
        <Space.Compact className="settings-snapshot-create"><Input maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="例如：更新外观前" /><Button type="primary" loading={busy} onClick={() => void createSnapshot()}>创建</Button></Space.Compact>
      </SettingRow>
    </SettingGroup> : null}

    {mode === "snapshots" ? <SettingGroup title={`已保存快照 · ${snapshots.length}`}>
      {snapshots.length ? snapshots.map(snapshot => <SettingRow key={snapshot.id} title={snapshot.name} description={`${new Date(snapshot.createdAt).toLocaleString("zh-CN")} · ${formatBytes(snapshot.compressedBytes)} · ${snapshot.manifest.sessions} 个会话 / ${snapshot.manifest.messages} 条消息 / ${snapshot.manifest.memories} 条记忆`} status={`v${snapshot.version}`}>
        <Space wrap>
          <Button loading={busy} onClick={() => void prepareSnapshot(snapshot)}>预览恢复</Button>
          <Button loading={busy} onClick={() => void downloadSnapshot(snapshot)}>导出文件</Button>
          <Popconfirm title="永久删除此快照？" description="快照文件无法从列表恢复；当前设置、记忆和会话不会改变。" okText="删除快照" cancelText="取消" onConfirm={() => void deleteSnapshot(snapshot)}>
            <Button danger loading={busy}>删除</Button>
          </Popconfirm>
        </Space>
      </SettingRow>) : <div className="settings-snapshot-empty">尚无账户快照。</div>}
    </SettingGroup> : null}

    {preview && source ? <SettingGroup title="恢复预览">
      <SettingRow title="校验结果" description={source.kind === "file" ? `${source.file.name} · ${formatBytes(source.file.size)}` : `当前账户快照 ${source.id}`}>
        <Tag color="green">完整性通过 · v{preview.version}</Tag>
      </SettingRow>
      <SettingRow title="设置" description={`将恢复 ${preview.settingsCategories.length} 个可移植分类；当前值不同的分类：${preview.changedSettingsCategories.length ? preview.changedSettingsCategories.join("、") : "无"}`}>
        <Checkbox checked={selection.settings} onChange={event => setSelection(value => ({ ...value, settings: event.target.checked }))}>恢复设置</Checkbox>
      </SettingRow>
      <SettingRow title="会话记忆" description={`${preview.memories} 条；${preview.memoryWillChange ? "与当前账户不同，恢复后将替换" : "与当前账户一致"}`}>
        <Checkbox checked={selection.memories} onChange={event => setSelection(value => ({ ...value, memories: event.target.checked }))}>恢复记忆</Checkbox>
      </SettingRow>
      <SettingRow title="会话" description={`${preview.sessions} 个归档会话、${preview.messages} 条公开消息；${preview.sessionConflicts} 个同 ID 冲突会跳过。`}>
        <Checkbox checked={selection.sessions} onChange={event => setSelection(value => ({ ...value, sessions: event.target.checked }))}>恢复会话</Checkbox>
      </SettingRow>
      <SettingRow title="Agent 上下文与附件" description={`${preview.contextSessions} 个会话含安全活动/分支检查点；${preview.attachments} 个附件，${formatBytes(preview.attachmentBytes)}。仅勾选恢复会话时一并导入。`}>
        <Tag color={preview.version === 2 ? "green" : "default"}>归档 v{preview.version}</Tag>
      </SettingRow>
      <div className="settings-snapshot-actions">
        <Button type="primary" loading={busy} disabled={!Object.values(selection).some(Boolean)} onClick={() => void restore()}>恢复所选资料</Button>
        <Button disabled={busy} onClick={clearPreview}>取消预览</Button>
      </div>
    </SettingGroup> : null}

    {result ? <Alert className="settings-snapshot-result" type="success" showIcon message="恢复完成" description={<div>
      {result.settings.restored.length ? <div>设置：{result.settings.restored.join("、")}</div> : null}
      {result.memories ? <div>记忆：恢复 {result.memories.restored} 条</div> : null}
      {result.sessions ? <div>会话：导入 {result.sessions.imported} 个，跳过冲突 {result.sessions.skipped} 个</div> : null}
      {result.attachments ? <div>附件：导入 {result.attachments.imported} 个，复用目标账户已有内容 {result.attachments.reused} 个</div> : null}
    </div>} /> : null}
  </section>;
}

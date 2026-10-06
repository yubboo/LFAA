/** 功能：管理当前账户登记的 AI Worktree。作用：删除前经确认在原 Daemon 上移除受管工作树；源项目保留。 */
import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, Modal, Popconfirm, Spin, Tag } from "antd";
import { getErrorMessage, loadWorkspaceProjects, removeWorkspaceProject, type WorkspaceProject } from "lfaa-client-connection/src/api.js";
import { SettingGroup, SettingRow } from "lfaa-client-ui-primitives/src/settings-controls.js";

export function GitWorktreesSettings() {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceProject | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadWorkspaceProjects().then(result => {
      if (active) setProjects(result.projects.filter(project => project.gitWorktree !== null));
    }).catch(loadError => {
      if (active) setError(getErrorMessage(loadError));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function remove(project: WorkspaceProject): Promise<boolean> {
    setRemovingId(project.id);
    setError("");
    try {
      await removeWorkspaceProject(project.id, true, project.appId ?? "workspace");
      setProjects(current => current.filter(item => item.id !== project.id));
      return true;
    } catch (removeError) { setError(getErrorMessage(removeError)); return false; }
    finally { setRemovingId(null); }
  }

  return <>
    {error ? <Alert className="settings-inline-alert" type="error" showIcon message={error} /> : null}
    <SettingGroup title="受管 AI Worktree">
      {loading ? <SettingRow title="正在读取工作树" description="向项目登记的 Daemon 查询账户隔离的 Worktree。"><Spin size="small" /></SettingRow> : null}
      {!loading && projects.length === 0 ? <SettingRow title="暂无 AI Worktree" description="在 AI Work 输入区选择一个 Git 项目，然后使用“创建 Worktree”。创建后，新会话会绑定到独立分支。"><Tag>尚未创建</Tag></SettingRow> : null}
      {projects.map(project => <SettingRow key={project.id} title={project.title} description={`分支 ${project.gitWorktree?.branch ?? "未知"} · 基线 ${project.gitWorktree?.baseCommit.slice(0, 8) ?? "未知"}`} status={project.gitWorktree?.createdAt ? new Date(project.gitWorktree.createdAt).toLocaleString("zh-CN") : "受管工作树"}>
        <Popconfirm title="删除此 AI Worktree？" description="下一步会再次确认永久删除隔离工作树中的文件；源项目不变，分支提交历史保留。" okText="下一步" cancelText="取消" onConfirm={() => { setDeleteTarget(project); setDeleteConfirmed(false); }}>
          <Button danger size="small" loading={removingId === project.id} disabled={Boolean(removingId)}>删除</Button>
        </Popconfirm>
      </SettingRow>)}
    </SettingGroup>
    <Modal title="再次确认删除 AI Worktree" open={Boolean(deleteTarget)} onCancel={() => { if (removingId !== deleteTarget?.id) setDeleteTarget(null); }} onOk={() => { if (deleteTarget && deleteConfirmed) void remove(deleteTarget).then(removed => { if (removed) setDeleteTarget(null); }); }} okText="删除工作树文件" cancelText="保留工作树" okButtonProps={{ danger: true, disabled: !deleteConfirmed || removingId === deleteTarget?.id }} confirmLoading={removingId === deleteTarget?.id} closable={removingId !== deleteTarget?.id} maskClosable={removingId !== deleteTarget?.id}>
      <p>这会删除受管工作树的全部文件。原始项目与源目录不受影响；分支 {deleteTarget?.gitWorktree?.branch} 会保留在源仓库中。</p>
      <Checkbox checked={deleteConfirmed} onChange={event => setDeleteConfirmed(event.target.checked)}>我确认永久删除这棵独立工作树</Checkbox>
    </Modal>
  </>;
}

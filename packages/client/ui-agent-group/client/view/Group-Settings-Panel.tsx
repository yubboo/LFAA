// 群聊创建与群设置表单：支持绑定工作区项目、混编选择内置/自定义角色与本机 CLI 代理，以及指定主持人。
// 关联：packages/client/ui-agent-group/client/view/Group-View.tsx；运行环境：浏览器。
import type { MemberOption, ProjectOption } from "../group/group-api";
import styles from "./Group-View.module.css";

export function GroupSettingsPanel({
  mode,
  isZh,
  title,
  projectId,
  selectedMembers,
  hostId,
  members,
  projects,
  busy,
  onTitleChange,
  onProjectChange,
  onToggleMember,
  onHostChange,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  isZh: boolean;
  title: string;
  projectId: string;
  selectedMembers: string[];
  hostId: string;
  members: MemberOption[];
  projects: ProjectOption[];
  busy: boolean;
  onTitleChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onToggleMember: (id: string) => void;
  onHostChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const canSubmit = selectedMembers.length >= 2 && !busy;

  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>
        {mode === "create" ? (isZh ? "新建群聊" : "New Group Chat") : (isZh ? "群聊设置" : "Group Settings")}
      </h3>

      <label className={styles.field}>
        <span>{isZh ? "群名称" : "Group name"}</span>
        <input
          className={styles.input}
          value={title}
          placeholder={isZh ? "例如：架构与代码审查群" : "e.g. Architecture & Review"}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>{isZh ? "绑定工作区项目（可选）" : "Bound workspace project (optional)"}</span>
        <select className={styles.input} value={projectId} onChange={(e) => onProjectChange(e.target.value)}>
          <option value="">{isZh ? "不绑定项目（默认工作区）" : "No project (default workspace)"}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </label>

      <div className={styles.field}>
        <span>{isZh ? `选择成员（至少 2 位，已选 ${selectedMembers.length} 位；支持角色与本机 CLI 混编）` : `Members (at least 2, ${selectedMembers.length} selected)`}</span>
        <div className={styles.chips}>
          {members.map((member) => {
            const active = selectedMembers.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                className={`${styles.chip} ${active ? styles.chipOn : ""}`}
                onClick={() => onToggleMember(member.id)}
              >
                <span>{member.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedMembers.length >= 2 && (
        <label className={styles.field}>
          <span>{isZh ? "主持人（未 @ 指定成员时由其规划发言顺序）" : "Host (plans speaking order when no @mention)"}</span>
          <select className={styles.input} value={hostId} onChange={(e) => onHostChange(e.target.value)}>
            {selectedMembers.map((id) => {
              const member = members.find((m) => m.id === id);
              return <option key={id} value={id}>{member?.name ?? id}</option>;
            })}
          </select>
        </label>
      )}

      <div className={styles.rowActions}>
        <button type="button" className={styles.primary} disabled={!canSubmit} onClick={onSubmit}>
          {mode === "create" ? (isZh ? "创建群聊" : "Create") : (isZh ? "保存设置" : "Save")}
        </button>
        <button type="button" className={styles.ghost} onClick={onCancel}>
          {isZh ? "取消" : "Cancel"}
        </button>
      </div>
    </section>
  );
}

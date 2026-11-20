// 右侧工作台欢迎页的运行状态列表：最近子智能体与后台任务，点击可跳到对应辅助面板。
import { IconCheck, IconCircleX, IconClock } from "@tabler/icons-react";
import type { RightSubagentItem } from "./RightSubagentsPane";
import type { RightJobItem } from "./RightTerminalPane";
import styles from "./RightWorkbenchPane.module.css";

export function WorkbenchStatusList({
  subagents,
  jobs,
  onSelectSubagent,
  onSelectJob,
}: {
  subagents: RightSubagentItem[];
  jobs: RightJobItem[];
  onSelectSubagent: (subagentId: string) => void;
  onSelectJob: (jobId: string) => void;
}) {
  return (
    <div className={styles.welcomeStatusList}>
      {subagents.slice(0, 3).map((sub) => (
        <button key={sub.id} type="button" className={styles.statusRow} onClick={() => onSelectSubagent(sub.id)}>
          {sub.status === "running" ? <IconClock size={13} /> : sub.status === "done" ? <IconCheck size={13} /> : <IconCircleX size={13} />}
          <span>{sub.role}</span>
        </button>
      ))}
      {jobs.slice(0, 3).map((job) => (
        <button key={job.id} type="button" className={styles.statusRow} onClick={() => onSelectJob(job.id)}>
          {job.status === "running" ? <IconClock size={13} /> : job.status === "done" ? <IconCheck size={13} /> : <IconCircleX size={13} />}
          <span>{job.title}</span>
        </button>
      ))}
    </div>
  );
}
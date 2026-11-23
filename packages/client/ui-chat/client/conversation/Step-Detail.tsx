// @lfaa/chat 步骤详情面板：点开某个动作后按「概览 / 参数 / 结果 / 计时」查看留痕，风格与聊天区一致。
import { useState } from "react";
import type { AgentStepItem } from "../store/chat-types";
import styles from "./Step-Detail.module.css";

type Tab = "overview" | "args" | "result" | "schema" | "timing";

/** 一段只读文本块，用于展示参数、结果等原始内容。 */
function Block({ label, value }: { label: string; value?: string | undefined }) {
  if (!value || !value.trim()) return null;
  return (
    <div className={styles.block}>
      <div className={styles.blockLabel}>{label}</div>
      <pre className={styles.pre}>{value}</pre>
    </div>
  );
}

/** 步骤详情：概览给要点，其余标签给原始数据。 */
export function StepDetail({ step, isZh }: { step: AgentStepItem; isZh: boolean }) {
  const [tab, setTab] = useState<Tab>("overview");
  const labels = isZh
    ? { overview: "概览", args: "参数", result: "结果", schema: "Schema", timing: "计时" }
    : { overview: "Overview", args: "Arguments", result: "Result", schema: "Schema", timing: "Timing" };

  const startedAt = step.startedAt;
  const finished = step.status === "done" || step.status === "error";
  const elapsed = startedAt !== undefined && finished ? Math.max(0, step.timestamp - startedAt) : undefined;
  const command = step.commandTrace;
  const status = isZh ? { preparing: "准备中", running: "进行中", waiting_approval: "等待审批", done: "已完成", error: "失败" }[step.status] : step.status;
  const phase = isZh ? { think: "思考", act: "行动", check: "检查" }[step.phase] : step.phase;

  return (
    <div className={styles.panel}>
      <div className={styles.tabs} role="tablist">
        {(Object.keys(labels) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ""}`}
            onClick={() => setTab(key)}
          >
            {labels[key]}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className={styles.rows}>
          <div className={styles.row}><span>{isZh ? "状态" : "Status"}</span><span>{status}</span></div>
          <div className={styles.row}><span>{isZh ? "阶段" : "Phase"}</span><span>{phase}</span></div>
          <div className={styles.row}><span>{isZh ? "轮次" : "Round"}</span><span>{step.iteration}</span></div>
          {step.toolName && <div className={styles.row}><span>{isZh ? "工具" : "Tool"}</span><span>{step.toolName}</span></div>}
          {step.toolTarget && <div className={styles.row}><span>{isZh ? "目标" : "Target"}</span><span className={styles.wrap}>{step.toolTarget}</span></div>}
          {step.fileChange && (
            <div className={styles.row}>
              <span>{isZh ? "文件变更" : "File change"}</span>
              <span>
                {step.fileChange.operation}
                {step.fileChange.path ? ` · ${step.fileChange.path}` : ""}
              </span>
            </div>
          )}
          {command?.exitCode !== undefined && (
            <div className={styles.row}><span>{isZh ? "退出码" : "Exit code"}</span><span>{command.exitCode}</span></div>
          )}
          {step.detail && <Block label={isZh ? "说明" : "Detail"} value={step.detail} />}
        </div>
      )}

      {tab === "args" && (
        <>
          <Block label={isZh ? "参数预览" : "Arguments preview"} value={step.argsPreview} />
          <Block label={isZh ? "命令" : "Command"} value={command?.command} />
          {!step.argsPreview && !command?.command && (
            <div className={styles.empty}>{isZh ? "该步骤没有记录参数。" : "No arguments recorded."}</div>
          )}
        </>
      )}

      {tab === "result" && (
        <>
          <Block label={isZh ? "结果预览" : "Result preview"} value={step.resultPreview} />
          <Block label={isZh ? "命令输出" : "Output"} value={command?.output} />
          {!step.resultPreview && !command?.output && (
            <div className={styles.empty}>{isZh ? "该步骤没有记录结果。" : "No result recorded."}</div>
          )}
        </>
      )}

      {tab === "schema" && <div className={styles.empty}>{isZh ? "该步骤未保存工具 Schema。" : "No tool schema was recorded for this step."}</div>}
      {tab === "timing" && (
        <div className={styles.rows}>
          <div className={styles.row}>
            <span>{isZh ? "开始时间" : "Started"}</span>
            <span>{startedAt === undefined ? (isZh ? "未记录" : "Not recorded") : new Date(startedAt).toLocaleString()}</span>
          </div>
          <div className={styles.row}>
            <span>{isZh ? "结束时间" : "Finished"}</span>
            <span>{finished ? new Date(step.timestamp).toLocaleString() : (isZh ? "尚未结束" : "In progress")}</span>
          </div>
          <div className={styles.row}>
            <span>{isZh ? "耗时" : "Duration"}</span>
            <span>{elapsed === undefined ? (isZh ? "不可用" : "Unavailable") : elapsed >= 1000 ? `${(elapsed / 1000).toFixed(1)} ${isZh ? "秒" : "s"}` : `${elapsed} ${isZh ? "毫秒" : "ms"}`}</span>
          </div>
        </div>
      )}
    </div>
  );
}

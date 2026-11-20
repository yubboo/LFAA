// @lfaa/chat 步骤详情面板：点开某个动作后按「概览 / 参数 / 结果 / 计时」查看留痕，风格与聊天区一致。
import { useState } from "react";
import type { AgentStepItem } from "../chat-types";
import styles from "./Step-Detail.module.css";

type Tab = "overview" | "args" | "result" | "timing";

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
    ? { overview: "概览", args: "参数", result: "结果", timing: "计时" }
    : { overview: "Overview", args: "Arguments", result: "Result", timing: "Timing" };

  const startedAt = step.startedAt ?? step.timestamp;
  const elapsed = Math.max(0, step.timestamp - startedAt);
  const command = step.commandTrace;

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
          <div className={styles.row}><span>状态</span><span>{step.status}</span></div>
          <div className={styles.row}><span>阶段</span><span>{step.phase}</span></div>
          <div className={styles.row}><span>轮次</span><span>{step.iteration}</span></div>
          {step.toolName && <div className={styles.row}><span>工具</span><span>{step.toolName}</span></div>}
          {step.toolTarget && <div className={styles.row}><span>目标</span><span className={styles.wrap}>{step.toolTarget}</span></div>}
          {step.fileChange && (
            <div className={styles.row}>
              <span>文件变更</span>
              <span>
                {step.fileChange.operation}
                {step.fileChange.path ? ` · ${step.fileChange.path}` : ""}
              </span>
            </div>
          )}
          {command?.exitCode !== undefined && (
            <div className={styles.row}><span>退出码</span><span>{command.exitCode}</span></div>
          )}
          {step.detail && <Block label={isZh ? "说明" : "Detail"} value={step.detail} />}
        </div>
      )}

      {tab === "args" && (
        <>
          <Block label={isZh ? "原始参数" : "Raw arguments"} value={step.argsPreview} />
          <Block label={isZh ? "命令" : "Command"} value={command?.command} />
          {!step.argsPreview && !command?.command && (
            <div className={styles.empty}>{isZh ? "该步骤没有记录参数。" : "No arguments recorded."}</div>
          )}
        </>
      )}

      {tab === "result" && (
        <>
          <Block label={isZh ? "原始结果" : "Raw result"} value={step.resultPreview} />
          <Block label={isZh ? "命令输出" : "Output"} value={command?.output} />
          {!step.resultPreview && !command?.output && (
            <div className={styles.empty}>{isZh ? "该步骤没有记录结果。" : "No result recorded."}</div>
          )}
        </>
      )}

      {tab === "timing" && (
        <div className={styles.rows}>
          <div className={styles.row}>
            <span>{isZh ? "开始时间" : "Started"}</span>
            <span>{new Date(startedAt).toLocaleTimeString()}</span>
          </div>
          <div className={styles.row}>
            <span>{isZh ? "结束时间" : "Finished"}</span>
            <span>{new Date(step.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className={styles.row}>
            <span>{isZh ? "耗时" : "Duration"}</span>
            <span>{elapsed >= 1000 ? `${(elapsed / 1000).toFixed(1)} 秒` : `${elapsed} 毫秒`}</span>
          </div>
        </div>
      )}
    </div>
  );
}

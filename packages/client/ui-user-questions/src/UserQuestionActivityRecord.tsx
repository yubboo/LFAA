/**
 * 文件：UserQuestionActivityRecord.tsx
 * 功能：呈现已回答、跳过或待处理问题的历史活动。
 * 作用：只按 Session/Connection 活动投影展示问题与结果。
 * 不负责：提交答案或改变 Run 状态。
 * 关联文件：UserQuestionPrompt.tsx、user-question.css。
 */
import type { AiActivityItem } from "lfaa-client-connection/src/api.js";

export interface UserQuestionActivityRecordProps {
  activity: AiActivityItem;
}

export function UserQuestionActivityRecord({ activity }: UserQuestionActivityRecordProps) {
  const questionText = activity.question ?? activity.detail ?? "";
  const skipped = activity.detail?.includes("选择跳过") ?? false;
  const answerText = activity.detail?.startsWith("你的回答：") ? activity.detail.slice("你的回答：".length).trim() : activity.detail;

  if (activity.status === "complete") return (
    <section className="ai-work-chat__question-record" aria-label="已回答的澄清问题">
      <strong>{questionText}</strong><p className="ai-work-chat__question-inline-answer">{skipped ? "已跳过" : answerText || "未记录文字答案"}</p>
    </section>
  );

  return (
    <section className="ai-work-chat__question-record" aria-label="澄清问题记录">
      <strong>{questionText}</strong><p className="ai-work-chat__question-inline-answer">{activity.detail || activity.title}</p>
    </section>
  );
}

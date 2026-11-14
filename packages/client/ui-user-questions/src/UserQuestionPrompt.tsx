/**
 * 文件：UserQuestionPrompt.tsx
 * 功能：呈现澄清问题、选项、受控答案输入和跳过动作。
 * 作用：只把用户选择/答案派发给聊天协调层。
 * 不负责：运行状态、答案持久化或 Agent 决策。
 * 关联文件：UserQuestionActivityRecord.tsx、user-question.css。
 */
import { Button, Input } from "antd";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

export interface UserQuestionPromptProps {
  question: string;
  questionId?: string;
  options: string[];
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: (answer: string, skipped?: boolean) => void;
}

export function UserQuestionPrompt({ question, questionId, options, value, busy, onChange, onSubmit }: UserQuestionPromptProps) {
  return (
    <section className="ai-work-chat__interaction-dock ai-work-chat__interaction-dock--question ai-work-chat__composer-interaction" aria-label="待回答的澄清问题">
      <div className="ai-work-chat__interaction-dock-heading">
        <span className="ai-work-chat__interaction-dock-icon"><WorkbenchIcon name="help" size={15} /></span>
        <strong>需要你补充信息</strong>
        <span>选择一个选项，或补充答案</span>
      </div>
      <p className="ai-work-chat__interaction-dock-question">{question}</p>
      {options.length ? <div className="ai-work-chat__interaction-dock-options" role="group" aria-label="选择回答">
        {options.map((option, index) => <button className="ai-work-chat__interaction-option" type="button" key={`${questionId}-${index}`} disabled={busy} onClick={() => onSubmit(option)}>
          <span className="ai-work-chat__interaction-option-number">{index + 1}</span><span>{option}</span><WorkbenchIcon name="chevron" size={14} />
        </button>)}
      </div> : null}
      <div className="ai-work-chat__interaction-dock-reply">
        <Input aria-label="补充回答" value={value} maxLength={12000} placeholder="或自行填写补充回答" disabled={busy} onChange={(event) => onChange(event.target.value)} onPressEnter={() => onSubmit(value)} />
        <Button type="text" disabled={busy} onClick={() => onSubmit("", true)}>跳过</Button>
        <Button type="primary" disabled={busy || !value.trim()} loading={busy} onClick={() => onSubmit(value)}>发送</Button>
      </div>
    </section>
  );
}

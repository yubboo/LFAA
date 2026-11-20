// 在输入框上方收集 Agent 的澄清答复。
import { useState } from "react";
import type { ChatMessageItem } from "../chat-types";
import styles from "./Clarification-Card.module.css";

export function ClarificationCard({ prompt, isZh, busy, onAnswer }: {
  prompt: NonNullable<ChatMessageItem["clarification"]>;
  isZh: boolean;
  busy: boolean;
  onAnswer: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState("");
  const value = answer.trim() || selected;
  return (
    <form className={styles.card} aria-label={isZh ? "Agent 提问" : "Agent question"}
      onSubmit={(event) => { event.preventDefault(); if (value && !busy) onAnswer(value); }}>
      <p>{prompt.question}</p>
      {prompt.options.map((option) => (
        <button key={option} type="button" className={styles.option} aria-pressed={selected === option}
          onClick={() => { setSelected(option); setAnswer(""); }} disabled={busy}>
          {option}
        </button>
      ))}
      <div className={styles.actions}>
        <input value={answer} onChange={(event) => { setAnswer(event.target.value); setSelected(""); }}
          aria-label={isZh ? "自定义答复" : "Custom answer"} placeholder={isZh ? "或输入你的答复" : "Or type your answer"} disabled={busy}/>
        <button type="button" disabled={busy} onClick={() => onAnswer(isZh
          ? "先跳过这个问题。请给我可选方案和差异，先不改动。"
          : "Skip this question for now. Explain the options and differences before making changes.")}>{isZh ? "跳过" : "Skip"}</button>
        <button type="submit" disabled={!value || busy}>{isZh ? "发送答复" : "Send answer"}</button>
      </div>
    </form>
  );
}

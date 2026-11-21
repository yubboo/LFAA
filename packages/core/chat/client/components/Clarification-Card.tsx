// 在输入框上方收集 Agent 的澄清答复。
import { useId, useState } from "react";
import type { ChatMessageItem } from "../chat-types";
import { mediaChatMessages } from "../locales";
import styles from "./Clarification-Card.module.css";

/** 跳过只关闭当前问题，用户可以继续编辑草稿。 */
export function ClarificationCard({ prompt, isZh, busy, chatRequired, messageId, onAnswer, onSkip }: {
  prompt: NonNullable<ChatMessageItem["clarification"]>;
  isZh: boolean;
  busy: boolean;
  chatRequired: boolean;
  messageId: string;
  onAnswer: (answer: string) => void;
  onSkip: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState("");
  const storageKey = `lfaa:skipped-clarification:${messageId}`;
  const [skipped, setSkipped] = useState(() => {
    try { return typeof window !== "undefined" && window.sessionStorage.getItem(storageKey) === "1"; }
    catch { return false; }
  });
  const headingId = useId();
  const labels = mediaChatMessages[isZh ? "zh" : "en"];
  if (skipped) return null;
  const value = answer.trim() || selected;
  const answerDisabled = busy || chatRequired;
  return (
    <form className={styles.card} aria-labelledby={headingId}
      onSubmit={(event) => { event.preventDefault(); if (value && !answerDisabled) onAnswer(value); }}>
      <h2 id={headingId}>{prompt.question}</h2>
      <div className={styles.options}>
        {prompt.options.map((option) => (
          <button key={option} type="button" className={styles.option} aria-pressed={selected === option}
            onClick={() => { setSelected(option); setAnswer(""); }} disabled={answerDisabled}>
            {option}
          </button>
        ))}
      </div>
      <div className={styles.actions}>
        <input value={answer} onChange={(event) => { setAnswer(event.target.value); setSelected(""); }}
          aria-label={labels.custom} placeholder={chatRequired ? labels.chatRequired : labels.placeholder} disabled={answerDisabled}/>
        <button type="button" className={styles.skip} disabled={busy} onClick={() => {
          try { window.sessionStorage.setItem(storageKey, "1"); }
          catch { /* 浏览器存储受限时，当前卡片仍可关闭。 */ }
          setSkipped(true);
          onSkip();
        }}>{labels.skip}</button>
        <button type="submit" className={styles.send} disabled={!value || answerDisabled}>{labels.send}</button>
      </div>
    </form>
  );
}

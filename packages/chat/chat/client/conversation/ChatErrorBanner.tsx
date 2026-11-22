// 输入区上方的错误条：展示启动失败文案；工作区被占用时提供「用工作树并行」入口。
import styles from "./ChatErrorBanner.module.css";

/** 错误条只消费语义变量；冲突动作由父组件决定是否显示。 */
export function ChatErrorBanner({ message, isZh, showIsolate, onIsolate }: {
  message: string;
  isZh: boolean;
  /** 冲突来自工作区租约时显示并行入口。 */
  showIsolate: boolean;
  onIsolate: () => void;
}) {
  return (
    <div className={styles.root} role="alert">
      <span className={styles.text}>{message}</span>
      {showIsolate && (
        <button type="button" className={styles.action} onClick={onIsolate}>
          {isZh ? "用工作树并行" : "Isolate in worktree"}
        </button>
      )}
    </div>
  );
}
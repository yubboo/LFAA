// 无限画布错误边界：拦截动态分包过期（重新构建后旧 chunk 404）与运行时异常，避免整页白屏。
// 关联：packages/client/ui-canvas/client/index.tsx；运行环境：浏览器。
import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./Canvas-Error-Boundary.module.css";

const RELOAD_GUARD_KEY = "lfaa-chunk-reload-at";
const RELOAD_COOLDOWN_MS = 10_000;

/** 判断错误是否由静态资源更新后的动态分包加载失败引起。 */
function isChunkLoadError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk/iu.test(text);
}

interface Props {
  isZh: boolean;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("无限画布渲染异常：", error, info.componentStack);
    if (!isChunkLoadError(error)) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? "0");
      if (Date.now() - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // sessionStorage 不可用时留在降级卡片由用户手动刷新。
    }
  }

  private readonly handleRetry = (): void => {
    this.setState({ error: null });
  };

  private readonly handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { isZh } = this.props;
    const isChunk = isChunkLoadError(error);
    const title = isChunk
      ? (isZh ? "页面资源已更新" : "App assets updated")
      : (isZh ? "无限画布加载失败" : "Failed to load Infinite Canvas");
    const desc = isChunk
      ? (isZh ? "请刷新页面加载最新画布组件。" : "Reload the page to load the latest canvas assets.")
      : (error.message || (isZh ? "发生未知渲染异常。" : "An unexpected error occurred."));

    return (
      <div className={styles.root} role="alert">
        <div className={styles.card}>
          <div className={styles.title}>{title}</div>
          <div className={styles.desc}>{desc}</div>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={this.handleReload}>
              {isZh ? "刷新页面" : "Reload"}
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={this.handleRetry}>
              {isZh ? "重试" : "Retry"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * 文件：PlanModeBanner.tsx
 * 功能：呈现当前会话处于计划讨论模式时的状态和继续动作。
 * 作用：只展示聊天层传入的状态并派发退出/批准回调。
 * 不负责：Session 状态、模型工具限制、计划切换 API 或消息发送。
 * 关联文件：plan-mode.css、packages/client/ui-chat/src/AiWorkChat.tsx。
 */
import { Button } from "antd";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

export interface PlanModeBannerProps {
  busy: boolean;
  modeBusy: boolean;
  canApprove: boolean;
  onExit: () => void;
  onApprove: () => void;
}

export function PlanModeBanner({ busy, modeBusy, canApprove, onExit, onApprove }: PlanModeBannerProps) {
  return <section className="ai-work-chat__plan-mode" aria-label="计划讨论模式" aria-live="polite">
    <span className="ai-work-chat__plan-mode-icon"><WorkbenchIcon name="spark" size={15} /></span>
    <div className="ai-work-chat__plan-mode-copy"><strong>计划讨论中</strong><span>当前只允许只读查询；确认计划后才会执行写入操作。</span></div>
    <div className="ai-work-chat__plan-mode-actions">
      <Button size="small" disabled={busy || modeBusy} loading={modeBusy} onClick={onExit}>退出计划</Button>
      {canApprove ? <Button size="small" type="primary" disabled={busy || modeBusy} onClick={onApprove}>批准并执行</Button> : null}
    </div>
  </section>;
}

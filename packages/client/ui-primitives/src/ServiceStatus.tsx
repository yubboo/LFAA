/**
 * 功能：展示控制端当前的连通状态。
 * 作用：在登录页和工作台顶部使用统一的可读状态提示。
 * 关联文件：packages/client/ui-renderer/src/App.tsx、packages/client/ui-settings-account/src/AuthView.tsx、packages/client/ui-layout/src/Workbench.tsx。
 */
export type ServiceState = "checking" | "online" | "offline";

interface ServiceStatusProps {
  state: ServiceState;
  compact?: boolean;
}

const stateLabels: Record<ServiceState, string> = {
  checking: "正在检查服务",
  online: "服务运行正常",
  offline: "无法连接服务"
};

const compactStateLabels: Record<ServiceState, string> = {
  checking: "正在检查服务器",
  online: "服务器正常",
  offline: "服务器未连接"
};

export function ServiceStatus({ state, compact = false }: ServiceStatusProps) {
  const label = compact ? compactStateLabels[state] : stateLabels[state];
  return (
    <span
      className={`service-status service-status--${state}${compact ? " service-status--compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={compact ? label : undefined}
      tabIndex={compact ? 0 : undefined}
    >
      <span className="service-status__dot" aria-hidden="true" />
      <span className="service-status__label">{label}</span>
    </span>
  );
}

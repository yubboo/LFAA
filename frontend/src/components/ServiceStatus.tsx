/**
 * 功能：展示控制端当前的连通状态。
 * 作用：在登录页和工作台顶部使用统一的可读状态提示。
 * 关联文件：frontend/src/App.tsx、frontend/src/components/AuthView.tsx、frontend/src/components/Workbench.tsx。
 */
export type ServiceState = "checking" | "online" | "offline";

interface ServiceStatusProps {
  state: ServiceState;
}

const stateLabels: Record<ServiceState, string> = {
  checking: "正在检查服务",
  online: "服务运行正常",
  offline: "无法连接服务"
};

export function ServiceStatus({ state }: ServiceStatusProps) {
  return (
    <span className={`service-status service-status--${state}`} role="status" aria-live="polite">
      <span className="service-status__dot" aria-hidden="true" />
      <span>{stateLabels[state]}</span>
    </span>
  );
}

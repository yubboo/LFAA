export const workspaceProjectManagerEventName = "lfaa:open-workspace-project-manager";

export function openWorkspaceProjectManager(projectId?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(workspaceProjectManagerEventName, { detail: { projectId: projectId ?? null } }));
}

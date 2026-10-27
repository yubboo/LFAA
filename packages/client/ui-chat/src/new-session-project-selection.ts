export function resolveNewSessionWorkspaceProjectId(input: {
  requestedProjectId: string | null;
  defaultProjectId: string | null;
  selectedProjectId: string | null;
  selectionIsExplicit: boolean;
}): string | null {
  return input.requestedProjectId ?? (input.selectionIsExplicit ? input.selectedProjectId : input.defaultProjectId);
}

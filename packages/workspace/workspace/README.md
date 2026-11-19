# `@lfaa/workspace`

Workspace and local-project plugin package for LFAA.

- `src/index.ts`: Host Cordis service (`WorkspaceService`) with zero React/DOM/CSS dependencies.
- `client/index.tsx`: Browser Cordis plugin (`inject: ["workbench"]`) contributing local project storage, project overview/detail views, creation dialog, and right-side context panels to the four-column Shell.

Creating a project by name uses a same-name folder in the default projects location. If the folder already exists, confirming trust binds the project to it and preserves its contents. The user confirms again if the default path changes before creation.

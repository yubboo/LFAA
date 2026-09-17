# Desktop Renderer

Desktop Renderer 最终复用 `@lfaa/app-shell` 与 `@lfaa/ui`。

安全要求：

- `nodeIntegration = false`
- `contextIsolation = true`
- `sandbox = true`
- Renderer 无 OS 权限

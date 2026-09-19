# Web Host

## 作用

LFAA Web 本地开发与验证宿主。Web-first 表示当前先用浏览器做业务验收，不表示共享 UI / 业务属于 Web。

## 负责

- Vite / React 启动入口；
- Web Router / Web Host Adapter；
- `.lfaa` 本地开发资源桥；
- Web 专属终端 / 浏览器宿主桥。

## 不负责

- 可复用业务 Feature UI（归 `packages/ui`）；
- Config / Account / Auth / Provider 业务（归 `packages/config-system`）；
- Provider 厂商 API 实现；
- Secret 真值。

## 本地启动

```text
LFAA-Setup.bat → 2 启动 Web
```

或：

```text
pnpm --filter @lfaa/web dev
```

源码导航：`apps/web/src/README.md`。

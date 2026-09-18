# 纯 UI

## 目录

`packages/ui`

## 当前职责

提供不拥有业务事实状态的 React UI Primitive 与 Layout。

当前已实现：

- `ResizableWorkbench`
- 左右栏自由拉伸
- 左 / 右 / 底部三向吸附收起
- 吸附后禁止从分隔条反向拖开，改用显式展开入口
- 展开状态支持键盘 Resize
- 本地宽度持久化
- 窄窗口浮层降级

## 不负责

- Config 真值
- Agent 真值
- Tool 执行
- `.lfaa` Resource Registry

## 对外 API

统一由 `src/index.ts` 暴露。

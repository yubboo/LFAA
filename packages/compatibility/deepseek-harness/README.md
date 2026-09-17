# DeepSeek Harness Compatibility

## 目标

尽可能复用 DeepSeek Harness / Cordis 生态中的现有插件，而不是重复造轮子。

## 原则

DeepSeek Harness 是 **兼容生态**，不是 LFAA Kernel。

```text
DSH Plugin
↓
Cordis Compatibility Runtime
↓
LFAA Capability Bridge
↓
Tool / Model / Agent Registry
↓
Policy / Permission
↓
Execution
```

## 安全

兼容插件不得：

- 绕过 LFAA Permission；
- 绕过 Tool Runtime；
- 直接获得 Secret；
- 直接污染 Electron Main；
- 直接获得全部本机权限。

## 版本

当前兼容层版本：

```text
0.1
```

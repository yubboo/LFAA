# LFAA-v0.0.14 Release

## 类型

Developer Workflow / Source Update Bug Fix

## 状态

```text
delivered
```

## 修复

`LFAA-Update` 在 ahead=0 / behind=0 时现在会直接判定“已是最新”，
不会继续执行无意义的远程文件 diff。

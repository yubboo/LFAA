# LFAA-v0.0.27 Release

## 状态

```text
delivered
```

## 任务

```text
#21 Web 工作台 UI
最新变更：#21.3
```

## 核心变化

- 侧栏 `min` 即自动吸附边界；
- Pointer Move 到 min 直接收起；
- 不再等待 Pointer Up；
- 删除独立 96px snapThreshold；
- 24px 迟滞防止边界抖动；
- 约 150ms 自动吸附动画。

## 待验证

Windows 实机重点验证左右侧栏到最小宽度时的吸附手感，以及反向拖回是否自然。

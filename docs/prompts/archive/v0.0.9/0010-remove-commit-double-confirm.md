# #10 移除 Commit 二次确认

## 主模块

`project-foundation`

## 问题

用户已经手工填写：

```text
【提交】【名称】
```

之后，脚本又要求：

```text
【确认】【创建提交】
```

属于重复确认，增加不必要的交互。

## 目标

流程改为：

```text
输入 Commit 名称
→ 直接创建本地 Commit
→ 检测远程
→ Push 前确认
```

## 保留

Push 前确认必须保留，因为 Push 会修改远程仓库。

## 不修改

- config-system 业务
- Agent Runtime
- Rust Broker

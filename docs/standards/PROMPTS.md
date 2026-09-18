# 开发 Prompt 规范

每个新业务先创建：

```text
docs/prompts/active/NNNN-中文短名.md
```

同一主任务的补充变更可使用：

```text
NNNN-NN-中文短名.md
```

任务完成后进入：

```text
docs/prompts/archive/<version>/
```

## Prompt 模板

```md
# #编号 问题名

## 主模块
## 任务目标
## 背景
## 允许修改
## 禁止修改
## 状态所有权
## 输入
## 输出
## 关联模块
## 实现约束
## 安全约束
## 验收条件
## 必须测试
## 必须更新的文档
## CHANGELOG 编号
## 版本目标
```

Prompt 是任务合同。

需求变化：

```text
先更新 Prompt
→ 更新 Development Log
→ 再改代码
```

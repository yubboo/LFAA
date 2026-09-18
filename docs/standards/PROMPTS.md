# 开发 Prompt 规范

每个新业务先创建：

```text
docs/prompts/active/NNNN-short-name.md
```

任务完成且不再作为当前开发依据后：

```text
docs/prompts/archive/<version>/
```

Prompt 模板：

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

Prompt 是任务合同；需求变化先改 Prompt，再改代码。

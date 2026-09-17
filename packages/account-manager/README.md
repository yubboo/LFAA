# Account Manager

## 目录

`packages/account-manager`

## 作用

API/OAuth/Local/官方允许的 Subscription Auth 账号配置。

## 负责什么

仅负责本模块公开职责。

## 不负责什么

- 不绕过上层架构边界。
- 不直接依赖其他模块 `src/internal/`。
- 不把无关业务塞入本模块。

## 对外 API

统一由 `src/index.ts` 暴露。

## 状态归属

如本模块拥有状态，必须在后续模块设计文档中明确唯一 Owner。

## 修改要求

修改本模块前先读取：

- `/DEVELOPMENT.md`
- `/ARCHITECTURE.md`
- 本 README
- 对应 Module PLAN / PROGRESS
- 当前 Active Prompt

# 模块边界规范

## 依赖方向

```text
UI
↓
Feature/Application
↓
Agent Client/Protocol
↓
Runtime
↓
Tool/Policy/Permission
↓
Rust Broker
↓
OS
```

只能向下依赖。

`Full` 权限、内部调用、调试模式都不能改变依赖方向或绕过 Tool Runtime / Policy / Permission / Rust Broker。

## Public / Internal

重要 package 后续可使用：

```text
src/public/
src/internal/
src/index.ts
```

包外只能通过 package public export。

禁止：

```ts
import x from "@lfaa/package/src/internal/x";
```

## State Owner

同一个事实状态只允许一个 Owner。

禁止 UI Store、Feature Store、Runtime 各存一份相同真值。

## 父子级

Child 不直接修改 Parent 私有状态。

Agent Child 不共享 Parent 可变内部状态。


## Import Boundary

跨模块依赖必须使用可识别的公开边界：

```text
同目录
→ ./

当前 workspace
→ @/

跨 workspace
→ @lfaa/*
```

禁止：

```text
../../
@lfaa/package/src/internal/*
```

导入路径规范属于架构边界，而不是代码风格偏好。

## Project Resource Boundary

Skills、Experts、Plugins、Extensions、MCP 只能从当前项目 `.lfaa/` 解析。

资源注册只能声明 capability，不能直接获得 OS、Secret、数据库或 Parent 私有状态。

## 新模块边界

新增 package/crate 前必须证明其具有独立安全边界、依赖生命周期、公共 API、发布责任或复用价值。

只有目录名称不同不构成独立模块理由。

# LFAA 导入路径规范

> 本规范用于避免 `../../../` 深层相对路径、跨模块内部引用和未来目录重构造成的大面积修改。

## 1. 三种导入方式

### 1.1 同目录 / 同一小模块内部

使用相对路径：

```ts
import { type SidebarItem } from "./left-sidebar.types";
import { SidebarItem } from "./SidebarItem";
```

### 1.2 当前 App / Package 内跨目录

使用：

```text
@/
```

`@/` 永远表示**当前 workspace 的 `src/`**。

示例：

```ts
import { useNavigationStore } from "@/features/navigation/navigation.store";
import { createSession } from "@/services/session.service";
```

### 1.3 跨 LFAA Workspace Package

使用真实 pnpm workspace package：

```text
@lfaa/*
```

示例：

```ts
import { type AgentEvent } from "@lfaa/protocol";
import { type AgentRun } from "@lfaa/domain";
import { Button } from "@lfaa/ui";
```

`@lfaa/*` 必须来自真实 `package.json.name`，不是靠 TypeScript `paths` 伪造。

---

## 2. 禁止深层相对路径

禁止：

```ts
import x from "../../something";
import x from "../../../something";
import x from "../../../../something";
```

默认规则：

- `./`：允许；
- 单层 `../`：仅限同一 Feature/模块内部确有必要时；
- `../../` 及更深：禁止，改用 `@/` 或 `@lfaa/*`。

---

## 3. 禁止跨 Package Internal

禁止：

```ts
import x from "@lfaa/domain/src/internal/x";
import x from "@lfaa/tool-runtime/src/x";
```

跨 Package 只能使用对外公开 Export：

```ts
import { x } from "@lfaa/domain";
```

如模块需要新增公共能力：

1. 在该 Package `src/index.ts` 增加明确 Export；
2. 更新该模块 README；
3. 如属于公共协议变更，记录 Prompt / Progress / Changelog。

---

## 4. `@/` 配置

每一个 TypeScript App / Package 自己拥有 `tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

特殊深度目录按实际路径调整 `extends`。

`@/` 不在根 `tsconfig.base.json` 中统一指向某个目录，因为每个 workspace 的 `@/` 都必须指向自己的 `src/`。

---

## 5. 构建工具必须同步识别

仅 TypeScript 能识别别名还不够。

以后启用真实构建工具时必须保证：

```text
TypeScript
Vite
Vitest
Electron build
Node bundle
```

对 `@/` 的解释一致。

如果某个运行环境不能解析 `@/`，不得临时退回 `../../../`；应该修复该 workspace 的构建配置。

---

## 6. Rust 不使用 `@/`

Rust 保持 Rust 原生模块路径：

```rust
use crate::process::ProcessRequest;
use super::ProcessState;
use lfaa_native_protocol::ProcessRequest;
```

禁止为了“统一视觉”给 Rust 发明自定义 `@` Alias。

---

## 7. 快速判断

```text
兄弟文件
→ ./

当前 workspace 内跨目录
→ @/

跨 LFAA workspace
→ @lfaa/*
```

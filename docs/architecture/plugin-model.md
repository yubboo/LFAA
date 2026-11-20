# 插件模型：内置插件 vs 外部插件

状态：**设计已定，来源解析已实现（DEV-000199）**；界面与安装流水线待实施。

## 1. 为什么必须分开

此前把两者混成一类，导致「内置插件也要点安装」这种荒谬交互。它们从**来源**到**生命周期**都不同：

| | 内置插件（Builtin） | 外部插件（External） |
|---|---|---|
| 来源 | 本仓 `packages/*` 的包 | npm / GitHub / 本地目录 / tarball |
| 是否随应用发布 | 是 | 否 |
| 能否安装 | **不存在这个概念** | 需要安装 |
| 能否卸载 | **不能**（只能停用） | 能 |
| 删除方式 | 只能删仓库目录 | 卸载即移除 |
| 状态 | 已启用 / 已停用（是否装配） | 未安装 / 已安装 / 运行中 |
| 归属 | bundle 装配清单 | profile 的 `package.json` 依赖 |

## 2. 内置插件：由 bundle 清单决定

- 应用启动时 bundle 按 `CORE_MODULES` + `OPTIONAL_MODULES` 装配，装配集合即「内置插件」。
- 界面只允许**启用 / 停用**：停用表示本次不装配；重新启用即重新装配。
- **不提供卸载**。要彻底移除，只能删仓库里的包目录——这正是 DSH 的行为。
- 卡片信息（对齐 DSH）：名称、说明、包 id、`完整名称`（npm 名）、`来自`（哪个 bundle）、`配置状态`、`运行状态`。

## 3. 外部插件：四种安装来源

对齐 DSH 的 `install-spec.ts`：

| 输入形态 | 归类 | 例子 |
|---|---|---|
| npm 包名（可带版本） | `registry` | `@scope/plugin`、`plugin@1.2.3` |
| GitHub / Git 地址 | `git` | `github:owner/repo`、`git+https://…`、`git@github.com:…`、`https://github.com/owner/repo` |
| 本地绝对路径 / `file:` / `link:` | `path` | `C:\plugins\x`、`link:C:\plugins\x` |
| `.tgz` / `.tar.gz`（本地或 URL） | `tarball` | `C:\p\plugin.tgz`、`https://host/plugin.tgz` |

相对路径一律拒绝——浏览器里输入的相对路径没有可信基准。

安装流程（对齐 DSH 的进度界面）：

```
校验来源 → 在 profile 执行 pnpm add <spec> → 解析包名与清单
        → 登记记录 → 立即启用 → 流式回显 pnpm 日志与阶段状态
```

界面要求：安装弹窗内显示来源类型、目标包、安装位置、**pnpm 实时输出**、可取消、失败可回滚。

## 4. 已实现 / 未实现

| 项 | 状态 |
|---|---|
| 来源解析 `parseInstallSpec` + 四类分类 + 非法输入拒绝 | ✅ 已实现并有单测（`packages/extension/plugins/src/install-spec.ts`） |
| 内置/外部数据模型区分（`kind` 字段、禁止卸载内置） | ❌ 待实施 |
| `pnpm add` 安装流水线与进度流 | ❌ 待实施 |
| 添加插件弹窗（三种入口 + 日志） | ❌ 待实施 |
| 内置插件页（仅启停 + 展开详情） | ❌ 待实施 |

## 5. 实施顺序

1. **数据模型**：`PluginRecord.kind`（`builtin` / `external`）；内置项由 bundle 清单生成，不可卸载；外部项走 profile 依赖。
2. **安装流水线**：`addExternal(spec)` → 校验 → `pnpm add`（复用 profile 安装能力）→ 解析包名 → 登记 → 启用；输出按行流式回传。
3. **界面拆分**：内置插件区（仅启停、可展开）、添加插件弹窗（三种入口 + 实时日志）、外部插件区（可卸载）。
4. **回滚**：安装失败时 `pnpm remove` 并删除记录，避免半装状态。

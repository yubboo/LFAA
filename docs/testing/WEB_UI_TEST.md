# Web 工作台本地测试

## 前置

```text
Node 24.x
pnpm 11.17.0
```

## 第一次安装

```text
LFAA-Setup.bat
→ 1 一键准备
```

本地 Setup 使用 `pnpm install`，新增 React/Vite 依赖时会同步 `pnpm-lock.yaml`。

## 启动 Vite

```text
LFAA-Setup.bat
→ 2 启动 Web
```

底层仍调用：

```text
pnpm --filter @lfaa/web dev
```

浏览器：

```text
http://127.0.0.1:5173
```

## Layout 测试

1. 拖动左分隔条；
2. 拖动右分隔条；
3. 拖到小于 128px，确认吸附收起；
4. 双击分隔条，确认收起 / 展开；
5. 刷新浏览器，确认宽度状态保留；
6. 缩小窗口，确认中央工作区不出现整页横向滚动。

## 热插拔测试

在以下目录新增或删除一个文件夹：

```text
.lfaa/skills/
.lfaa/plugins/
.lfaa/mcp/
```

右侧“资源舱”应自动刷新，无需手工刷新页面。

## 安全检查

浏览器 Network 中 `/__lfaa/dev/resources` 只允许出现：

- kind
- name
- relativePath
- entryType
- updatedAt

不得出现文件正文、Secret、Token 或绝对路径。

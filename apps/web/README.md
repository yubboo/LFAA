# Web

## 作用

LFAA Web 本地开发入口。

## 本地启动

依赖准备后：

```text
pnpm run dev:web
```

默认：

```text
http://127.0.0.1:5173
```

## 开发资源桥接

Vite 开发服务器只监听：

```text
.lfaa/skills
.lfaa/experts
.lfaa/plugins
.lfaa/extensions
.lfaa/mcp
```

浏览器只收到资源名称、相对路径、类型、更新时间，不读取正文和 Secret。


## 本地启动

Windows 推荐入口：

```text
LFAA-Setup.bat
→ 2 启动 Web
```

底层 workspace script：

```text
pnpm --filter @lfaa/web dev
```

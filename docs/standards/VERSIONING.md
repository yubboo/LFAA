# LFAA 版本规范

## 1. 正式版本格式

LFAA 统一使用标准三段式版本号：

```text
主版本.次版本.修订版本
MAJOR.MINOR.PATCH
```

首个版本：

```text
0.0.1
```

正式项目包：

```text
LFAA-v0.0.1.zip
```

## 2. 版本递增规则

每次正常小版本递增 PATCH：

```text
0.0.1
0.0.2
0.0.3
...
0.0.99
```

累计 100 个 PATCH 版本后进入下一 MINOR：

```text
0.0.99
→
0.1.0
```

之后继续：

```text
0.1.1
0.1.2
...
0.1.99
→
0.2.0
```

当项目进入明确的大版本阶段时再提升 MAJOR：

```text
0.x.x
→
1.0.0
```

MAJOR 提升必须有明确架构/产品级发布决策，不按普通小版本自动提升。

## 3. 正式发行文件名

必须使用：

```text
<项目简称>-v<MAJOR.MINOR.PATCH>.<ext>
```

源码/项目包：

```text
LFAA-v0.0.1.zip
```

桌面发行包：

```text
LFAA-v0.0.1-windows-x64.exe
LFAA-v0.0.1-macos-arm64.dmg
LFAA-v0.0.1-linux-x64.AppImage
```

正式包名禁止增加：

```text
flat
fixed
final
new
new2
latest
```

这类临时后缀。

## 4. ZIP 目录规则

正式 ZIP 内部直接放项目内容，不额外嵌套同名顶层目录。

正确：

```text
LFAA-v0.0.1.zip
解压到 LFAA-v0.0.1/
├── apps/
├── packages/
├── crates/
├── docs/
└── ...
```

禁止：

```text
LFAA-v0.0.1/
└── LFAA-v0.0.1/
```

## 5. 版本唯一来源

版本统一由：

```text
lfaa.release.json
```

作为项目级版本事实源。

构建/发布脚本负责同步：

- root `package.json`
- workspace package versions
- Rust crate versions
- CHANGELOG
- Release Notes
- 最终包名

禁止开发者在多个位置手工维护互相冲突的版本。

## 6. 兼容版本独立

以下版本不得与产品版本混为一谈：

- Agent Protocol Version
- Plugin API Version
- Database Schema Version
- DSH Compatibility Version

例如：

```text
Product: 0.0.1
Agent Protocol: 1
Plugin API: 1
DB Schema: 1
DSH Compatibility: 0.1
```

---
description: "LFAA 共享文件类型图标包：彩色文件与文件夹图标及扩展名映射，供工作区文件树、标签栏、面包屑与变更列表复用。"
kind: "package"
---

# @lfaa/ui-icons

[English](README.md) | 中文

## 摘要

LFAA 共享文件类型图标包：彩色文件与文件夹图标及扩展名映射，供工作区文件树、标签栏、面包屑与变更列表复用。

本包位于 `packages/ui/icons`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口，重导出映射契约 |
| `./contract` | `./lib/types/contract/index.js` | 公开映射契约，无 Node 或 DOM 依赖 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，导出 `FileTypeIcon` |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `react`

## 素材与许可

图标字形取自 `@iconify-json/vscode-icons@1.2.30`（vscode-icons，MIT），原始许可文本保留在 `LICENSES/vscode-icons-LICENSE.txt`；只打包文件树实际用到的字形。

## 开发说明

运行 `node scripts/test.mjs --filter ui/icons` 验证映射与渲染。
---
description: "项目画布持久化、连线校验与媒体执行。"
kind: "package"
---

# @lfaa/canvas

[English](README.md) | 中文

## 摘要

Cordis Host 服务将项目画布、素材版本和任务运行记录保存到本机 LFAA 的画布目录。Web Host 将项目范围内的请求交给本服务。

## 导出

- `.` 提供默认 Cordis 插件和画布服务。
- `./contract` 提供可在浏览器使用的画布、场景、运行类型和端口定义。

## 开发说明

Host 校验画布，用文档修订号保存编辑。视频任务保存厂商任务 ID 供后续查询。卸载插件保留已保存的画布。

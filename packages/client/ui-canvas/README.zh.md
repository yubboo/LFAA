---
description: "右侧工作台无限画布、媒体生成节点与 3D 白模预演。"
kind: "package"
---

# @lfaa/client-ui-canvas

[English](README.md) | 中文

## 摘要

浏览器插件在右侧工作台的新建标签页添加「无限画布」，承载项目画布编辑器和 3D 白模预演。

## 导出

- `./client` 提供浏览器 Cordis 插件。
- `.` 为包的构建入口，内容为空。

## 开发说明

React Flow 提供画布编辑和连线。Three.js 在打开白模节点时按需加载。画布文档与导出素材均通过带鉴权的项目画布接口保存。

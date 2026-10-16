# Settings API

本包登记认证后的设置路由，不复制身份、配置或数据迁移规则。总根与推荐调用 workspace/data-directory，分类目录读取 settings/project-storage 的派生投影；总根写入沿用原超级管理员合同。

POST /data-directory/recommended 由 Owner 选择项目 data，并返回真实当前/待迁移状态；已有自定义总根不会被推荐覆盖。旧 PUT /project-storage-locations 返回 independent_storage_retired，不再落盘六套分类根；GET 保留派生目录供现有 Consumer 展示。没有增加新审批模式或重置账户偏好。

构建仅写根 dist/packages/api/settings-controller；[数据与文件合同](../../../docs/development/file-resources.zh.md)。真实服务重载与数据迁移不由构建代替。

## 小鱼共享工作入口（2026-10-14）

GET /ai/skills 通过实际 Skill Registry 返回当前账户可见摘要，隐藏绝对路径、资源基址和正文；按插件开关过滤，连接关闭撤销发现。

构建只写仓库根 dist/packages/api/settings-controller/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

# 任务 API

本包将认证后的 Jobs/Runtime/节点请求交给原 Owner，保留账户、节点身份、任务租约、取消和未知结果合同，不自行执行环境安装或游戏业务。

运行环境、缓存、临时位置由目标节点唯一 data 根派生；旧 PUT /runtime-environments/storage/:targetId 明确返回 independent_storage_retired，GET 与运行任务继续消费原 Runtime Manager。已保存的旧环境根仅作回读候选，安装与更新不新建独立根。

构建写根 dist/packages/api/job-controller；[本轮数据根规范](../../../docs/development/file-resources.zh.md)。实际节点与设备验收和隔离任务夹具分开记录。

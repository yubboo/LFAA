# `lfaa-api-local-model-controller`

认证后的本机模型目录、下载、进度、取消与释放内存 API。控制器只接受 LFAA Runtime 已登记模型 ID，不接收本机绝对路径、仓库地址、外部代码或账户模型密钥；权重目录与推理生命周期由 `lfaa-llm-local-runtime` 唯一持有。

构建输出为仓库根 `dist/packages/api/local-model-controller/`。

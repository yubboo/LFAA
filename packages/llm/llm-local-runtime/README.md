# `lfaa-llm-local-runtime`

LFAA 自己的本地模型目录、Hub 下载与适配器运行时核心。它位于 `packages/llm`，与远程 Provider Owner `lfaa-llm` 并列；不依赖、嵌入或启动 ComfyUI。

本包管理 LFAA Data 根下的模型目录、固定公开模型源下载、原子落盘、进度/取消和已注册模型适配器。模型家族适配器负责读取原生组件目录、报告可用性及提供真实推理执行器。只有注册了 LFAA 适配器的模型才会被识别和运行；未知目录只作为未识别文件保留，不会尝试执行其中代码。

默认模型路径按模态分别位于 `models/image/`、`models/video/`、`models/text/`、`models/audio/`，下载只接受已登记适配器的固定 HTTPS Hugging Face 仓库和适配器文件选择器。模型代码不运行远端仓库 Python 文件；需要上游推理代码的适配器必须随 LFAA 以可审阅来源和许可证单独发布。模型权重不会进入源码、应用包或构建目录。

本机模型服务仅在控制端工作区加载。API Controller 负责当前用户认证，Settings/AI Video 读取现有账户偏好，AI Video 仍拥有项目媒体事务；本包不创建账户、密钥、审批或模型 Provider 选择的第二份权威状态。本机 Runtime 另提供账户隔离的 `input/`、`output/` 文件镜像：调用方只能传当前认证账户、有限 MIME 与已校验媒体字节，文件名由服务端净化、UUID 防冲突并原子落盘，不接受 Client 路径。AI Video 上传素材写入 `input/<账户 SHA-256>/`；本机推理的已提交图片/视频写入 `output/<账户 SHA-256>/`。这些是可在文件系统中直接访问的用户数据，运行时不自动清理。

构建输出为仓库根 `dist/packages/llm/llm-local-runtime/`。安装、推理依赖和设备能力按适配器真实探测；下载成功不代表硬件可运行。

# `lfaa-llm-minimax-h3`

LFAA 本地模型核心的 MiniMax-H3 FL2VA 适配器，加载 Hugging Face 原生模型目录到 LFAA Data `models/video/minimax-h3/`。只运行随包审阅的 Diffusers ModularPipeline 接口，不调用 ComfyUI、不执行 Hub 下载的 Python 源码。

适配器提供文本到视频/音频及单首帧图生视频。下载器按官方 ModularPipeline 工作流只选择顶层 `transformer/` 与共享编码器/VAE/调度器组件，排除 `transformer_ref/`、独立 `FL2VA/`/`Ref2VA/` 分区副本和模型仓库代码。完整官方仓库页面约 498 GB；下载时 LFAA 会遍历 Hugging Face 分页后的实际文件清单并显示本次选择的精确字节数，不用整仓大小推算模型变体体积。模型使用 MiniMax-H3 社区许可证，下载前先阅读并自行在来源页确认适用条件；LFAA 不代表用户接受许可证。

本机推理需要支持 BF16 的 CUDA GPU、较大主机内存与带 MiniMax-H3 ModularPipeline 的 Diffusers；24–32 GB 显存使用 TorchAO Int8 + 分组 CPU offload。较小设备、缺少依赖或许可证/仓库访问受限时返回真实原因。完成文件下载只代表权重在本机，不代表本机硬件能完成推理。

构建输出为仓库根 `dist/packages/llm/llm-minimax-h3/`。

# `lfaa-llm-moss-image`

LFAA 自有本地模型核心的 MOSS-Image 系列适配器。它识别并加载官方 Hugging Face / Diffusers 模型目录，例如 `models/image/moss-image-sft/` 下的 `transformer/`、`text_encoder/`、`tokenizer/`、`vae/`，不读取 ComfyUI repack safetensors，不调用 ComfyUI，也不执行模型仓库内的 Python 文件。

适配器在本包内发布可审阅的 Apache-2.0 推理管线，检查 `model_index.json` 的 `_class_name` 与各组件配置/权重，再通过 LFAA `lfaaSubprocess` 使用受管 Python worker 加载。由 `lfaa-llm-local-runtime` 统一登记可用模型、Hub 下载、进度、取消和目录边界；AI Video 仍负责将已成功的 PNG 校验后写入账户项目素材。

首批登记 `OpenMOSS-Team/MOSS-Image-Base` 和 `OpenMOSS-Team/MOSS-Image-SFT`，来源许可证为 Apache-2.0。推理使用本地 BF16 权重与 CUDA GPU；缺少 CUDA、BF16 支持、PyTorch/Diffusers/Transformers/Accelerate/Safetensors/Pillow 等运行依赖时明确报错。LFAA 不会运行远端自定义 pipeline 代码、自动安装依赖或静默切换 Provider。图片结果写入 LFAA Data 临时目录，验证 PNG 签名与 16 MiB 上限后交回 AI Video Owner。

构建输出为仓库根 `dist/packages/llm/llm-moss-image/`。

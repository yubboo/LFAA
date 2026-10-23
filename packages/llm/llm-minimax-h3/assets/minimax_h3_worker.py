"""LFAA's local MiniMax-H3 FL2VA adapter using the native Diffusers modular model directory."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path


def _load_pipeline(model_path: Path):
    import torch
    from diffusers import ComponentsManager, ModularPipeline

    if not torch.cuda.is_available():
        raise RuntimeError("MiniMax-H3 本机视频生成需要可用的 CUDA GPU。")
    if not torch.cuda.is_bf16_supported():
        raise RuntimeError("MiniMax-H3 BF16 权重需要 GPU 支持 bfloat16。")
    if not model_path.is_absolute() or not model_path.is_dir():
        raise ValueError("LFAA MiniMax-H3 模型目录无效。")

    memory_bytes = torch.cuda.get_device_properties(0).total_memory
    if memory_bytes >= 80 * 1024**3:
        manager = ComponentsManager()
        manager.enable_auto_cpu_offload(device="cuda", memory_reserve_margin="12GB")
        pipe = ModularPipeline.from_pretrained(
            str(model_path), workflow="fl2va", components_manager=manager, local_files_only=True
        )
        pipe.load_components(workflow="fl2va", dtype=torch.bfloat16)
        return pipe

    if memory_bytes < 24 * 1024**3:
        raise RuntimeError("MiniMax-H3 的 LFAA 适配最低要求 24 GiB CUDA 显存；当前 GPU 显存不足。")
    if _physical_memory_bytes() < 75 * 1024**3:
        raise RuntimeError("MiniMax-H3 24–32 GiB GPU 的 Int8 分组卸载至少需要 75 GiB 主机内存。")

    from diffusers import MiniMaxH3Transformer3DModel, TorchAoConfig
    from diffusers.hooks import apply_group_offloading
    from transformers import Qwen3VLForConditionalGeneration
    from transformers import TorchAoConfig as TransformersTorchAoConfig
    from torchao.quantization import Int8WeightOnlyConfig

    pipe = ModularPipeline.from_pretrained(str(model_path), workflow="fl2va", local_files_only=True)
    pipe.update_components(
        transformer=MiniMaxH3Transformer3DModel.from_pretrained(
            str(model_path), subfolder="transformer", dtype=torch.bfloat16,
            quantization_config=TorchAoConfig(
                Int8WeightOnlyConfig(version=2),
                modules_to_not_convert=["proj_in", "audio_proj_in", "context_embedder", "time_embedder", "time_proj", "token_refiner", "norm_out", "proj_out", "audio_proj_out"],
            ),
            low_cpu_mem_usage=False,
            local_files_only=True,
        ),
        text_encoder=Qwen3VLForConditionalGeneration.from_pretrained(
            str(model_path), subfolder="text_encoder", dtype=torch.bfloat16,
            quantization_config=TransformersTorchAoConfig(
                Int8WeightOnlyConfig(version=2),
                modules_to_not_convert=["model.visual", "model.language_model.embed_tokens", "model.language_model.norm", "lm_head"],
            ),
            local_files_only=True,
        ),
    )
    pipe.load_components(workflow="fl2va", dtype=torch.bfloat16)
    pipe.transformer.requires_grad_(False)
    pipe.text_encoder.requires_grad_(False)
    offload = {"onload_device": torch.device("cuda"), "offload_device": torch.device("cpu"), "use_stream": True}
    pipe.transformer.enable_group_offload(offload_type="block_level", num_blocks_per_group=1, **offload)
    apply_group_offloading(pipe.text_encoder.model, offload_type="leaf_level", **offload)
    pipe.vae.to("cuda")
    pipe.audio_vae.to("cuda")
    return pipe


def _physical_memory_bytes() -> int:
    if sys.platform == "win32":
        import ctypes

        class MemoryStatus(ctypes.Structure):
            _fields_ = [
                ("length", ctypes.c_ulong), ("memory_load", ctypes.c_ulong),
                ("total_phys", ctypes.c_ulonglong), ("avail_phys", ctypes.c_ulonglong),
                ("total_page_file", ctypes.c_ulonglong), ("avail_page_file", ctypes.c_ulonglong),
                ("total_virtual", ctypes.c_ulonglong), ("avail_virtual", ctypes.c_ulonglong),
                ("avail_extended_virtual", ctypes.c_ulonglong),
            ]

        status = MemoryStatus()
        status.length = ctypes.sizeof(MemoryStatus)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
            return 0
        return int(status.total_phys)
    try:
        import os
        return int(os.sysconf("SC_PHYS_PAGES") * os.sysconf("SC_PAGE_SIZE"))
    except (OSError, ValueError, AttributeError):
        return 0


def _frame_count(duration_seconds: int) -> int:
    target = duration_seconds * 24
    steps = max(0, math.ceil((target - 5) / 17))
    return 17 * steps + 5


def _dimensions(ratio: str) -> tuple[int, int]:
    # Native H3 canvases are multiples of 32; 960x544 is the documented lower-cost 16:9 path.
    dimensions = {
        "16:9": (960, 544),
        "9:16": (544, 960),
        "1:1": (768, 768),
        "4:3": (736, 544),
        "3:4": (544, 736),
    }
    if ratio not in dimensions:
        raise ValueError("MiniMax-H3 视频比例无效。")
    return dimensions[ratio]


def _valid_output_path(path: Path, data_path: Path) -> bool:
    if not path.is_absolute() or path.exists():
        return False
    try:
        path.resolve(strict=False).relative_to(data_path.resolve(strict=True))
        path.parent.resolve(strict=True).relative_to(data_path.resolve(strict=True))
    except (OSError, ValueError):
        return False
    return True


def main() -> int:
    raw = sys.stdin.buffer.readline(32 * 1024 * 1024 + 1)
    if len(raw) > 32 * 1024 * 1024 or not raw:
        raise ValueError("MiniMax-H3 加载请求无效或超过 32 MiB。")
    request = json.loads(raw.decode("utf-8"))
    if not isinstance(request, dict) or request.get("type") != "load" or request.get("modelId") != "minimax-h3":
        raise ValueError("MiniMax-H3 进程必须先加载 LFAA 已登记模型。")
    model_path = Path(request.get("modelPath", ""))
    pipe = _load_pipeline(model_path)
    print(json.dumps({"type": "ready", "modelId": "minimax-h3"}), flush=True)

    for raw_request in sys.stdin.buffer:
        if len(raw_request) > 32 * 1024 * 1024:
            continue
        task_id = ""
        try:
            item = json.loads(raw_request.decode("utf-8"))
            task_id = item.get("id") if isinstance(item, dict) else None
            prompt = item.get("prompt") if isinstance(item, dict) else None
            output_path = Path(item.get("outputPath", "")) if isinstance(item, dict) else Path()
            data_path = Path(item.get("dataPath", "")) if isinstance(item, dict) else Path()
            if item.get("modelId") != "minimax-h3":
                raise ValueError("MiniMax-H3 请求模型与当前进程不一致。")
            if not isinstance(task_id, str) or len(task_id) > 80 or not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 5_000:
                raise ValueError("MiniMax-H3 提示词无效或超过 5000 字符。")
            duration = item.get("durationSeconds")
            if type(duration) is not int or duration < 5 or duration > 15:
                raise ValueError("MiniMax-H3 原生 FL2VA 时长范围是 5 至 15 秒。")
            width, height = _dimensions(item.get("aspectRatio", "16:9"))
            if not _valid_output_path(output_path, data_path):
                raise ValueError("MiniMax-H3 输出文件必须位于 LFAA Data 临时目录且不能覆盖现有文件。")

            kwargs = {
                "prompt": prompt.strip(),
                "num_frames": _frame_count(duration),
                "height": height,
                "width": width,
                "generator": torch_generator(),
                "output": ["videos", "audio", "sampling_rate"],
            }
            image_path = item.get("inputImagePath")
            if isinstance(image_path, str) and image_path:
                image = Path(image_path)
                if not image.is_absolute() or not image.is_file():
                    raise ValueError("MiniMax-H3 首帧必须是已验证的本地输入文件。")
                kwargs["image"] = load_image(image)

            result = pipe(**kwargs)
            from diffusers.utils.export_utils import encode_video

            encode_video(
                result["videos"][0], fps=24, output_path=str(output_path),
                audio=result["audio"][0], audio_sample_rate=result["sampling_rate"]
            )
            print(json.dumps({"type": "result", "id": task_id, "ok": True}), flush=True)
        except Exception as error:
            message = str(error).replace("\n", " ")[:1_200] or error.__class__.__name__
            print(json.dumps({"type": "result", "id": task_id if isinstance(task_id, str) else "", "ok": False, "error": message}), flush=True)
    return 0


def torch_generator():
    import torch
    return torch.Generator(device="cpu").manual_seed(torch.seed())


def load_image(path: Path):
    from diffusers.utils import load_image as diffusers_load_image
    return diffusers_load_image(str(path))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as error:
        message = str(error).replace("\n", " ")[:1_200] or error.__class__.__name__
        print(json.dumps({"type": "fatal", "error": message}), flush=True)
        raise SystemExit(2)

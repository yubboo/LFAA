"""LFAA-owned MOSS-Image loader for the official Hugging Face / Diffusers directory format."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ASSETS = Path(__file__).resolve().parent
sys.path.insert(0, str(ASSETS))


def _load_pipeline(model_path: Path):
    import torch
    from pipeline_moss_image import MOSSImagePipeline

    if not torch.cuda.is_available():
        raise RuntimeError("MOSS-Image 当前适配需要可用的 CUDA GPU；本机没有可用 CUDA 设备。")
    if not torch.cuda.is_bf16_supported():
        raise RuntimeError("MOSS-Image 官方 BF16 权重要求 GPU 支持 bfloat16。")
    if not model_path.is_absolute() or not model_path.is_dir():
        raise ValueError("LFAA MOSS-Image 模型目录无效。")

    pipe = MOSSImagePipeline.from_components_pretrained(
        transformer_path=model_path / "transformer",
        text_encoder_path=model_path / "text_encoder",
        tokenizer_path=model_path / "tokenizer",
        vae_path=model_path / "vae",
        torch_dtype=torch.bfloat16,
        vae_dtype=torch.float32,
        local_files_only=True,
    )
    pipe.enable_model_cpu_offload(device="cuda")
    pipe.set_progress_bar_config(disable=True)
    return pipe


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
        raise ValueError("本机 MOSS-Image 加载请求无效或超过 32 MiB。")
    request = json.loads(raw.decode("utf-8"))
    if not isinstance(request, dict) or request.get("type") != "load":
        raise ValueError("MOSS-Image 进程必须先装载 LFAA 已识别的原生模型目录。")
    model_id = request.get("modelId")
    model_path = Path(request.get("modelPath", ""))
    if not isinstance(model_id, str) or model_id not in {"moss-image-base", "moss-image-sft"}:
        raise ValueError("MOSS-Image 模型 ID 未登记。")
    pipe = _load_pipeline(model_path)
    print(json.dumps({"type": "ready", "modelId": model_id}, ensure_ascii=False), flush=True)

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
            if item.get("modelId") != model_id:
                raise ValueError("MOSS-Image 请求模型与当前进程不一致。")
            if not isinstance(task_id, str) or len(task_id) > 80 or not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 4_000:
                raise ValueError("MOSS-Image 生图提示词无效或超出 4000 字符。")
            if not _valid_output_path(output_path, data_path):
                raise ValueError("MOSS-Image 输出文件必须位于 LFAA Data 临时目录且不能覆盖现有文件。")
            result = pipe(
                prompt.strip(),
                height=1024,
                width=1024,
                num_inference_steps=50,
                guidance_scale=3.0,
                uncond_skip_layers=[22],
            )
            result.images[0].save(output_path, format="PNG")
            print(json.dumps({"type": "result", "id": task_id, "ok": True}, ensure_ascii=False), flush=True)
        except Exception as error:
            message = str(error).replace("\n", " ")[:1200] or error.__class__.__name__
            print(json.dumps({"type": "result", "id": task_id if isinstance(task_id, str) else "", "ok": False, "error": message}, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as error:
        message = str(error).replace("\n", " ")[:1200] or error.__class__.__name__
        print(json.dumps({"type": "fatal", "error": message}, ensure_ascii=False), flush=True)
        raise SystemExit(2)

/** 功能：回归 LFAA 自有模型分类及 MOSS/H3 原生 Diffusers 目录识别。作用：只创建合成配置与空权重文件。 */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const temporaryParent = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
mkdirSync(temporaryParent, { recursive: true });
const dataDirectory = mkdtempSync(join(temporaryParent, "lfaa-local-model-catalog-"));
after(() => {
  if (dirname(dataDirectory) !== temporaryParent) throw new Error("拒绝清理测试根以外的路径。");
  rmSync(dataDirectory, { recursive: true, force: true });
});

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value), "utf8");
}

function makeMossDirectory(root, className = "MOSSImagePipeline") {
  writeJson(join(root, "model_index.json"), { _class_name: className });
  for (const component of ["transformer", "text_encoder", "tokenizer", "vae"]) {
    writeJson(join(root, component, component === "tokenizer" ? "tokenizer.json" : "config.json"), {});
  }
  for (const component of ["transformer", "text_encoder", "vae"]) {
    writeFileSync(join(root, component, "diffusion_pytorch_model.safetensors"), Buffer.alloc(0));
  }
}

test("LFAA initializes its own model categories without ComfyUI category folders", async () => {
  const { ensureDataDirectories } = await import("lfaa-home-paths/src/data-layout.mjs");
  const paths = ensureDataDirectories(dataDirectory);
  for (const name of ["text", "image", "video", "audio", "encoders", "vae", "adapters", "acceleration", "upscalers"]) {
    assert.ok(lstatSync(join(paths.models, name)).isDirectory(), `models/${name} should be initialized`);
  }
  for (const name of ["diffusion_models", "text_encoders", "loras", "model_patches", "upscale_models"]) {
    assert.equal(existsSync(join(paths.models, name)), false, `models/${name} should not be created by LFAA`);
  }
  assert.ok(lstatSync(paths.input).isDirectory());
  assert.ok(lstatSync(paths.output).isDirectory());
});

test("MOSS-Image identifies its native Diffusers components and ignores remote Python", async () => {
  const { ensureDataDirectories } = await import("lfaa-home-paths/src/data-layout.mjs");
  const { MOSS_IMAGE_MODELS, inspectMossImageModel } = await import("lfaa-llm-moss-image/src/model-catalog.js");
  const paths = ensureDataDirectories(dataDirectory);
  const modelDirectory = join(paths.models, "image", "moss-image-sft-fixture");
  makeMossDirectory(modelDirectory);
  assert.deepEqual(await inspectMossImageModel(modelDirectory), { ready: true, reason: null });
  assert.equal(MOSS_IMAGE_MODELS[1].includeFile("transformer/diffusion_pytorch_model.safetensors"), true);
  assert.equal(MOSS_IMAGE_MODELS[1].includeFile("scheduler/scheduler_config.json"), false);
  assert.equal(MOSS_IMAGE_MODELS[1].includeFile("pipeline_moss_image.py"), false);
  assert.equal(MOSS_IMAGE_MODELS[1].includeFile("transformer/attacker.py"), false);
  assert.deepEqual(await inspectMossImageModel(join(paths.models, "image", "missing")), { ready: false, reason: "找不到 LFAA 本机模型目录。" });
  const wrongDirectory = join(paths.models, "image", "wrong-fixture");
  makeMossDirectory(wrongDirectory, "DiffusionPipeline");
  assert.equal((await inspectMossImageModel(wrongDirectory)).ready, false);
});

test("MiniMax-H3 recognizes the native FL2VA file family and excludes Ref2VA and Python", async () => {
  const { ensureDataDirectories } = await import("lfaa-home-paths/src/data-layout.mjs");
  const { MINIMAX_H3_MODEL, inspectMiniMaxH3 } = await import("lfaa-llm-minimax-h3/src/model-catalog.js");
  const paths = ensureDataDirectories(dataDirectory);
  const modelDirectory = join(paths.models, "video", "minimax-h3-fixture");
  const modelIndex = { _class_name: "MiniMaxH3ModularPipeline", _blocks_class_name: "MiniMaxH3Blocks" };
  writeJson(join(modelDirectory, "modular_model_index.json"), modelIndex);
  writeJson(join(modelDirectory, "model_index.json"), modelIndex);
  for (const file of [
    "transformer/config.json", "text_encoder/config.json", "tokenizer/tokenizer.json",
    "processor/preprocessor_config.json", "vae/config.json", "audio_vae/config.json",
    "scheduler/scheduler_config.json", "audio_scheduler/scheduler_config.json"
  ]) writeJson(join(modelDirectory, file), {});
  for (const component of ["transformer", "text_encoder", "vae", "audio_vae"]) {
    writeFileSync(join(modelDirectory, component, "diffusion_pytorch_model.safetensors"), Buffer.alloc(0));
  }
  assert.deepEqual(await inspectMiniMaxH3(modelDirectory), { ready: true, reason: null });
  assert.equal(MINIMAX_H3_MODEL.includeFile("transformer/diffusion_pytorch_model.safetensors"), true);
  assert.equal(MINIMAX_H3_MODEL.includeFile("transformer_ref/diffusion_pytorch_model.safetensors"), false);
  assert.equal(MINIMAX_H3_MODEL.includeFile("FL2VA/transformer/model.safetensors"), false);
  assert.equal(MINIMAX_H3_MODEL.includeFile("Ref2VA/transformer/model.safetensors"), false);
  assert.equal(MINIMAX_H3_MODEL.includeFile("transformer/remote_code.py"), false);
  assert.equal(MINIMAX_H3_MODEL.estimatedDownloadBytes, null);
});

test("LFAA Hub downloader follows paginated model trees before selecting files", async () => {
  const { downloadHubModel } = await import("lfaa-llm-local-runtime/src/hub-download.js");
  const previousFetch = globalThis.fetch;
  const revision = "a".repeat(40);
  let treePages = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname === "/api/models/test/fake") return new Response(JSON.stringify({ sha: revision }), { headers: { "Content-Type": "application/json" } });
    if (url.pathname === `/api/models/test/fake/tree/${revision}`) {
      treePages += 1;
      if (treePages === 1) {
        const next = new URL(url);
        next.searchParams.set("cursor", "page-two");
        const page = Array.from({ length: 100 }, (_, index) => ({ type: "file", path: `ignored-${index}.bin`, size: 0 }));
        return new Response(JSON.stringify(page), { headers: { "Content-Type": "application/json", Link: `<${next.href}>; rel="next"` } });
      }
      return new Response(JSON.stringify([{ type: "file", path: "weights/model.safetensors", size: 0 }]), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === `/test/fake/resolve/${revision}/weights/model.safetensors`) return new Response(new Uint8Array());
    throw new Error(`Unexpected Hub request: ${url.href}`);
  };
  try {
    const modelDirectory = join(dataDirectory, "download-fixture");
    const definition = {
      id: "test-model", family: "fixture", modality: "image", name: "Fixture", repository: "test/fake",
      licenseName: "fixture", licenseUrl: "https://example.invalid/license", estimatedDownloadBytes: null,
      modelDirectory: "image/test-model", includeFile: path => path === "weights/model.safetensors"
    };
    const download = await downloadHubModel(definition, modelDirectory, new AbortController().signal, () => undefined);
    assert.equal(treePages, 2);
    assert.equal(download.totalFiles, 1);
    assert.equal(download.totalBytes, 0);
    assert.equal(existsSync(join(modelDirectory, "weights", "model.safetensors")), true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

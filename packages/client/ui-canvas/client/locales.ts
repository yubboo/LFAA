// 无限画布术语和端口标签，供节点、预演台和项目面板消费。
export const labels = {
  zh: {
    prompt: "提示词", asset: "参考素材", previs: "3D 白模", image: "生图", video: "生视频",
    text: "文本", character: "角色参考", composition: "构图参考", first: "首帧", last: "尾帧", motion: "运动参考",
    add: "添加节点", open: "打开", create: "新建画布", title: "画布名称", empty: "还没有画布",
    noProject: "选择一个项目后打开无限画布", boards: "画布列表", upload: "导入素材", edit: "编辑节点",
    save: "保存", saving: "保存中", saved: "已保存", reload: "重新载入", output: "产物",
    starting: "正在提交", running: "正在生成", succeeded: "已完成", failed: "失败", uncertain: "待核对",
    run: "生成", selectModel: "选择模型", unset: "自动", ratio: "比例", duration: "时长（秒）", seed: "种子",
    resolution: "分辨率", mode: "生成模式", frames: "首尾帧", reference: "参考素材", download: "下载",
    choose: "选用此版本", selected: "已选", outdated: "参数已修改", invalid: "连接需要可用产物、相同类型和空闲端口，且不能成环。",
    frameOutput: "构图静帧", clipOutput: "预演短片",
    remove: "删除选中节点或连线", noOutput: "请先生成或导入素材", refresh: "刷新状态",
  },
  en: {
    prompt: "Prompt", asset: "Reference", previs: "3D previs", image: "Generate image", video: "Generate video",
    text: "Text", character: "Character", composition: "Composition", first: "First frame", last: "Last frame", motion: "Motion reference",
    add: "Add node", open: "Open", create: "New canvas", title: "Canvas name", empty: "No canvases yet",
    noProject: "Select a project to open a canvas", boards: "Canvases", upload: "Import media", edit: "Edit node",
    save: "Save", saving: "Saving", saved: "Saved", reload: "Reload", output: "Outputs",
    starting: "Submitting", running: "Generating", succeeded: "Complete", failed: "Failed", uncertain: "Needs review",
    run: "Generate", selectModel: "Select model", unset: "Auto", ratio: "Aspect ratio", duration: "Duration (s)", seed: "Seed",
    resolution: "Resolution", mode: "Generation mode", frames: "First and last frames", reference: "References", download: "Download",
    choose: "Use version", selected: "Selected", outdated: "Parameters changed", invalid: "A connection needs an available output and a free matching input. Cycles are excluded.",
    frameOutput: "Composition frame", clipOutput: "Previs clip",
    remove: "Delete selected nodes or connections", noOutput: "Generate or import media first", refresh: "Refresh status",
  },
};

export type CanvasLabels = typeof labels.en;

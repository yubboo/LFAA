---
name: office-pptx
description: Create, read, edit, and check PowerPoint presentations (.pptx), including slide text, tables, images, and charts. Use when a PPTX file is an input or requested deliverable. Load this skill before running Office commands.
---

# PowerPoint presentations

> 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-skill-office。
> LFAA 差异：使用系统已安装的 Python（需自行 `pip install python-pptx`）；随包未提供 LibreOffice Kit，可按任务发现目标主机实际可用的渲染依赖，见文末说明。

Use `python-pptx` to inspect or modify an existing presentation. Keep scripts and output files in the task workspace. Match the requested slide language and the supplied presentation's design when editing it.

## Create and edit

Inspect slide layouts, text runs, images, tables, and charts before editing. Change only the requested content, preserve mixed text formatting, and save to a new file unless the user requests an in-place edit. Rebuilding slides can discard unsupported animation, SmartArt, or other extension content.

For a new deck, use `python-pptx` with editable text, tables, and charts. Use local image assets rather than network-dependent image URLs. Set slide dimensions, text sizes, and chart data explicitly.

A minimal editable deck:

```python
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches, Pt

presentation = Presentation()
presentation.slide_width = Inches(13.333)
presentation.slide_height = Inches(7.5)
slide = presentation.slides.add_slide(presentation.slide_layouts[6])
title = slide.shapes.add_textbox(Inches(0.6), Inches(0.4), Inches(12), Inches(0.8))
run = title.text_frame.paragraphs[0].add_run()
run.text = "Quarterly report"
run.font.size = Pt(30)
data = CategoryChartData()
data.categories = ["Q1", "Q2"]
data.add_series("Revenue", [12, 18])
slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED,
                       Inches(0.8), Inches(1.6), Inches(11.5), Inches(4.8), data)
presentation.save("report.pptx")
```

Use `Inches` or `Cm` for positions and sizes and `Pt` for font sizes. Check that text and images fit the slide dimensions, titles form a useful sequence, and chart labels agree with source values. A native chart's embedded workbook is part of the deliverable and must contain the intended data.

## Check and deliver

Run the shared checker with the system Python; `<skill-directory>` is this loaded skill's resource base:

```text
python <skill-directory>/../scripts/check_office.py <presentation.pptx> --out <checks.json>
```

It checks ZIP/XML integrity and internal relationships and reports slide count and extracted text. Use repeated `--contains TEXT` arguments for required slide text and `--count N` for a requested slide count. Reopen the file to check the requested edits, chart data, and notes. Structural success does not establish text fit, alignment, readable contrast, or rendering fidelity.

## Rendering and recalculation dependencies

随包未提供 LibreOffice Kit。需要视觉检查、PDF/图片渲染或公式重算时，先通过本轮真实工具查询目标主机已安装的 Python、Office/LibreOffice 或其他适用程序，再选择可用方法。缺少必要依赖时，安装与执行统一按当前请求审批、替我审批、完全访问模式处理，不增加人工确认旁路；依赖安装到任务环境，不修改共享 Skill 资源目录。
只根据实际执行结果报告渲染、重算与校验状态。没有可用渲染器时说明尚未验证的视觉效果，不把结构检查成功当作视觉检查成功。

---
name: office-docx
description: Create, read, edit, and check Word documents (.docx), including reports, letters, and formatted tables. Use when a DOCX file is an input or requested deliverable. Load this skill before running Office commands.
---

# Word documents

> 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-skill-office。
> LFAA 差异：DSH 通过 `load_workspace_dependencies` 注入打包 Python 与 python-docx；LFAA 不打包运行时，
> 请使用系统已安装的 Python 环境（需自行 `pip install python-docx`）。随包未提供 LibreOffice Kit，可按任务发现目标主机实际可用的渲染依赖，见文末说明。

Use `python-docx` for DOCX creation and ordinary edits. Use an available Python environment; dependency discovery or installation follows the current permission mode. Keep installations outside the shared skill resource directory. If python-docx is unavailable, report the missing dependency only when it prevents the requested operation.

Keep source scripts, intermediate files, and final documents in the task workspace; the runtime and this skill directory are read-only resources. Use the user's requested language and preserve an existing document's design unless a redesign is requested.

## Create and edit

For existing files, inspect paragraphs, runs, tables, sections, headers, and footers before changing the affected content. Save to a new file unless the user requests an in-place edit. Replacing a paragraph's `.text` destroys its run formatting; change the relevant runs when formatting must survive. Reconstructing the whole document can lose features outside python-docx's supported editing API.

Use paragraph styles for headings and body text. Size tables for the section that contains them, and account for merged cells and nested tables. Chinese, Japanese, and Korean text may need an explicit `w:eastAsia` font assignment in addition to `run.font.name`; font names alone do not establish glyph availability or rendered appearance.

For a new document:

```python
from docx import Document

document = Document()
document.add_heading("Project report", level=0)
document.add_paragraph("Summary", style="Heading 1")
document.add_paragraph("The requested findings go here.")
document.save("report.docx")
```

python-docx does not paginate or render documents. Do not represent ordinary replacement, colored text, or comments as tracked changes. When real revisions or unsupported OOXML features matter, preserve their package parts and verify the requested operation rather than silently discarding them.

## Check and deliver

Run the shared checker with the system Python; `<skill-directory>` is this loaded skill's resource base:

```text
python <skill-directory>/../scripts/check_office.py <document.docx> --out <checks.json>
```

It checks ZIP/XML integrity and internal relationships, and reports paragraphs, logical table dimensions, and sections. Optional `--contains TEXT` arguments assert required text. A successful structural check does not verify pagination, clipping, fonts, or visual appearance. Compare the summary and reopened document with the user's request, including unchanged content that matters to an edit.

## Rendering and recalculation dependencies

随包未提供 LibreOffice Kit。需要视觉检查、PDF/图片渲染或公式重算时，先通过本轮真实工具查询目标主机已安装的 Python、Office/LibreOffice 或其他适用程序，再选择可用方法。缺少必要依赖时，安装与执行统一按当前请求审批、替我审批、完全访问模式处理，不增加人工确认旁路；依赖安装到任务环境，不修改共享 Skill 资源目录。
只根据实际执行结果报告渲染、重算与校验状态。没有可用渲染器时说明尚未验证的视觉效果，不把结构检查成功当作视觉检查成功。

---
name: office-xlsx
description: Read, create, and modify Excel workbooks (.xlsx), including data, formulas, formatting, and pandas analysis. Use for Excel inputs or deliverables. Load before running Office commands. Data and formula tasks skip visual inspection; inspect only for formatting or layout needs.
---

# Excel workbooks

> 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-skill-office。
> LFAA 差异：使用系统已安装的 Python（需自行 `pip install openpyxl pandas`）；随包未提供 LibreOffice Kit，可按任务发现目标主机实际可用的重算/渲染依赖，见文末说明。

Keep scripts, working files, and outputs in the task workspace. The runtime and skill directory are shared read-only resources. Save to a new workbook unless the user requests an in-place edit.

## Read and modify

Use `openpyxl` for existing XLSX workbooks and targeted cell or style changes. Load with `data_only=False` when formulas must survive. Inspect sheet names, the affected cell types, formulas, styles, merged ranges, and referenced ranges before editing. Check the saved file by reopening it, including unchanged content that the request requires preserving.

Use pandas for data analysis and transformations. A DataFrame is not the workbook: exporting it over an existing file can lose sheets, formulas, charts, and formatting. Write analysis results back to the intended ranges with openpyxl. `XlsxWriter` can create new workbooks, but cannot read or modify existing ones.

For a new workbook:

```python
from openpyxl import Workbook
from openpyxl.styles import Font

workbook = Workbook()
sheet = workbook.active
sheet.title = "Revenue"
for row in [("Quarter", "Revenue"), ("Q1", 12), ("Q2", 18), ("Total", "=SUM(B2:B3)")]:
    sheet.append(row)
for cell in sheet[1]:
    cell.font = Font(bold=True)
sheet.column_dimensions["A"].width = 18
sheet.column_dimensions["B"].width = 18
workbook.save("report.xlsx")
```

Preserve numbers, dates, booleans, and identifiers as the intended cell types; formatting is not a type conversion. Avoid a DataFrame round trip when workbook features must survive.

Writing a formula does not calculate its result. openpyxl and XlsxWriter do not evaluate Excel formulas; `data_only=True` returns stored cached values that may be absent or stale. Without a recalculation engine (LFAA 未集成 LibreOffice Kit 的 `recalculate`), state the limit; do not replace requested formulas with constants or report old cached values as newly calculated results.

Do not rename `.xls`, `.xlsb`, encrypted files, or macro-enabled files to `.xlsx`. They need an appropriate supported operation. `keep_vba=True` can preserve VBA package content in an XLSM workflow, but does not execute or edit macros.

## Check and deliver

Run the shared checker with the system Python; `<skill-directory>` is this loaded skill's resource base:

```text
python <skill-directory>/../scripts/check_office.py <workbook.xlsx> --out <checks.json>
```

It checks ZIP/XML integrity and internal relationships, and reports sheet names, populated-cell counts, and formula counts. Repeated `--contains TEXT` arguments check string cells and sheet names, and `--count N` checks sheet count. The checker does not calculate formulas or judge workbook appearance. Compare relevant values, types, formulas, styles, and totals with the task's source data.

For data and formula tasks, deliver after structural and data checks pass. Skip preview rendering and visual inspection. Basic styling such as bold headers or number formats does not itself require visual inspection.

## LibreOffice operations（集成需要，当前不可用）

本部署未集成 LibreOffice Kit CLI。公式重算、PDF 导出与表格渲染为图片等能力暂不可用；
不要搜索系统 `soffice`、不要自行搭建渲染管线。交付前用 openpyxl 复核数据与公式即可。

// 一次性修复：把恢复文件里残留的 o/c 混淆词还原（按最长优先，避免二次替换）。
import { readFileSync, writeFileSync } from "node:fs";

const path = "E:/lfaa/.tmp/wt-restored.tsx";
let text = readFileSync(path, "utf8");

const dictionary = [
  ["WorkbenohClientServioe", "WorkbenchClientService"],
  ["oloseBrowserTabsExoept", "closeBrowserTabsExcept"],
  ["OloseBrowserTabsExoept", "CloseBrowserTabsExcept"],
  ["useWorkbenohTabMenu", "useWorkbenchTabMenu"],
  ["WorkbenohTabMenu", "WorkbenchTabMenu"],
  ["WorkbenohTabs", "WorkbenchTabs"],
  ["workbenoh", "workbench"],
  ["Workbenoh", "Workbench"],
  ["formatShortoutKeys", "formatShortcutKeys"],
  ["readShortoutKeysFor", "readShortcutKeysFor"],
  ["formatShortout", "formatShortcut"],
  ["Shortout", "Shortcut"],
  ["shortout", "shortcut"],
  ["aotiveFileTab", "activeFileTab"],
  ["aotiveAuxTab", "activeAuxTab"],
  ["aotiveSubagentTabId", "activeSubagentTabId"],
  ["aotiveBrowserTabId", "activeBrowserTabId"],
  ["AotivateBrowserTab", "ActivateBrowserTab"],
  ["onSeleot", "onSelect"],
  ["Seleot", "Select"],
  ["seleot", "select"],
  ["olientX", "clientX"],
  ["olientY", "clientY"],
  ["olient-ui-browser/olient", "client-ui-browser/client"],
  ["ui-layout/olient", "ui-layout/client"],
  ["ui-primitives/olient", "ui-primitives/client"],
  ["ui-ioons/olient", "ui-icons/client"],
  ["@tabler/ioons-reaot", "@tabler/icons-react"],
  ["module.oss", "module.css"],
  ["reaot", "react"],
  ["Reaot", "React"],
  ["ioons", "icons"],
  ["Ioons", "Icons"],
  ["Ioon", "Icon"],
  ["oonst", "const"],
  ["Oonst", "Const"],
  ["olass", "class"],
  ["Olass", "Class"],
  ["funotion", "function"],
  ["Funotion", "Function"],
  ["olose", "close"],
  ["Olose", "Close"],
  ["Objeot", "Object"],
  ["Reoord", "Record"],
  ["ohanges", "changes"],
  ["Ohanges", "Changes"],
  ["aotive", "active"],
  ["Aotive", "Active"],
  ["Servioe", "Service"],
  ["Exoept", "Except"],
];

for (const [from, to] of dictionary) text = text.replaceAll(from, to);
writeFileSync(path, text);
console.log("dictionary applied");

// 列出仍含可疑 "o+辅音" 组合的标识符，交人工核对。
const suspicious = [...text.matchAll(/[A-Za-z]*o[A-Za-z]*/gu)]
  .map((m) => m[0])
  .filter((word) => /(oonst|olose|aotive|seleot|olient|ioon|oss\b|reaot|ohange|Servioe|Exoept)/u.test(word));
console.log("remaining suspicious:", [...new Set(suspicious)].join(", ") || "(none)");
// 一次性脚本：把本轮（+ 号连续新建标签）的日志编号从 000581 改为 000582，避免与并发会话重号。
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";

const devLog = "E:/lfaa/docs/dev-log/000401-000600.md";
const oldUpdate = "E:/lfaa/docs/updata-log/000581-20261126-1410-new-tab-repeat.md";
const newUpdate = "E:/lfaa/docs/updata-log/000582-20261126-1410-new-tab-repeat.md";

let text = readFileSync(devLog, "utf8");
const before = text;
text = text.replace(
  "# DEV-000581｜工作台「+」与新建标签快捷键：空白标签在场时也能连续新建",
  "# DEV-000582｜工作台「+」与新建标签快捷键：空白标签在场时也能连续新建",
);
text = text.replace(
  "- 任务编号：DEV-000581\n- 英文任务名：new-tab-repeat",
  "- 任务编号：DEV-000582\n- 英文任务名：new-tab-repeat",
);
text = text.replaceAll("docs/updata-log/000581-20261126-1410-new-tab-repeat.md", "docs/updata-log/000582-20261126-1410-new-tab-repeat.md");
text = text.replace("- 用户可见：是，新增 UPDATE-000581。", "- 用户可见：是，新增 UPDATE-000582。");
if (text === before) throw new Error("dev-log 未发生变化");
writeFileSync(devLog, text);

if (!existsSync(oldUpdate)) throw new Error("找不到 updata 文件");
let update = readFileSync(oldUpdate, "utf8");
update = update.replace("# UPDATE-000581｜", "# UPDATE-000582｜");
writeFileSync(oldUpdate, update);
renameSync(oldUpdate, newUpdate);
console.log("renumbered to 000582");
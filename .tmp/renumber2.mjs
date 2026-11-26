// 一次性脚本：本轮（+ 号连续新建标签）日志编号改用 000590，避开并发会话正在占用的 58x 段。
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";

const devLog = "E:/lfaa/docs/dev-log/000401-000600.md";
const from = "000582";
const to = "000590";
const oldUpdate = `E:/lfaa/docs/updata-log/${from}-20261126-1410-new-tab-repeat.md`;
const newUpdate = `E:/lfaa/docs/updata-log/${to}-20261126-1410-new-tab-repeat.md`;

let text = readFileSync(devLog, "utf8");
const before = text;
text = text.replace(
  `# DEV-${from}｜工作台「+」与新建标签快捷键：空白标签在场时也能连续新建`,
  `# DEV-${to}｜工作台「+」与新建标签快捷键：空白标签在场时也能连续新建`,
);
text = text.replace(
  `- 任务编号：DEV-${from}\n- 英文任务名：new-tab-repeat`,
  `- 任务编号：DEV-${to}\n- 英文任务名：new-tab-repeat`,
);
text = text.replaceAll(`docs/updata-log/${from}-20261126-1410-new-tab-repeat.md`, `docs/updata-log/${to}-20261126-1410-new-tab-repeat.md`);
text = text.replace(`- 用户可见：是，新增 UPDATE-${from}。`, `- 用户可见：是，新增 UPDATE-${to}。`);
if (text === before) throw new Error("dev-log 未发生变化");
writeFileSync(devLog, text);

if (!existsSync(oldUpdate)) throw new Error("找不到 updata 文件");
let update = readFileSync(oldUpdate, "utf8");
update = update.replace(`# UPDATE-${from}｜`, `# UPDATE-${to}｜`);
writeFileSync(oldUpdate, update);
renameSync(oldUpdate, newUpdate);
console.log(`renumbered ${from} -> ${to}`);
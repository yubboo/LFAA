/**
 * 功能：从真实版本迁移链构造完整的历史数据库测试夹具。
 * 作用：只在长期测试中执行截至目标版本的迁移，避免手工省略表导致后续升级失真。
 * 关联文件：database-migrations.test.mjs、packages/storage/storage-sqlite/src/database.ts；不进入产品运行树。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

export function createHistoricalSchema(database, targetVersion) {
  assert.ok(Number.isInteger(targetVersion) && targetVersion >= 1 && targetVersion <= 30);
  const text = readFileSync(new URL("../../../../packages/storage/storage-sqlite/src/database.ts", import.meta.url), "utf8");
  const source = ts.createSourceFile("database.ts", text, ts.ScriptTarget.Latest, true);
  const migrations = source.statements.filter(statement => {
    if (!ts.isIfStatement(statement) || !ts.isBlock(statement.thenStatement)) return false;
    const condition = statement.expression;
    return ts.isBinaryExpression(condition) && condition.left.getText(source) === "currentVersion"
      && condition.operatorToken.kind === ts.SyntaxKind.LessThanToken
      && ts.isNumericLiteral(condition.right) && Number(condition.right.text) <= targetVersion;
  });
  assert.ok(migrations.length > 0);
  const code = ts.transpileModule(migrations.map(statement => statement.getText(source)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  }).outputText;
  const hasColumn = (table, column) => database.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column);
  // 代码只来自仓库中已读取的迁移链；没有产品测试开关或外部输入。
  new Function("database", "currentVersion", "hasColumn", code)(database, 0, hasColumn);
  database.exec(`PRAGMA user_version = ${targetVersion};`);
}

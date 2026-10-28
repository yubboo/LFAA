import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectGitTree, workspaceGitStatusKind, workspaceGitStatusLabel } from "../../../packages/client/ui-workspace/src/project-file-git-tree.ts";

const file = (path, projectPath, status = " M") => ({ status, path, projectPath, displayPath: path, insertions: 1, deletions: 0 });

test("项目 Git 变更树只按有效项目相对路径构建并稳定排序", () => {
  const modified = file("repo/src/index.ts", "src/index.ts", " M");
  const added = file("repo/docs/README.md", "docs/README.md", "??");
  const rootFile = file("repo/package.json", "package.json", "M ");
  const invalid = file("repo/escape.ts", "../escape.ts", "??");
  const absolute = file("C:/outside.ts", "C:/outside.ts", "??");
  const deep = file("repo/src/api/controllers/index.ts", "src/api/controllers/index.ts", " M");
  const tree = buildProjectGitTree([rootFile, modified, invalid, absolute, added, deep]);

  assert.deepEqual(tree.map(node => `${node.kind}:${node.name}`), ["directory:docs", "directory:src", "file:package.json"]);
  assert.equal(tree[0]?.kind, "directory");
  assert.equal(tree[0]?.kind === "directory" ? tree[0].children[0]?.kind : "", "file");
  assert.deepEqual(tree[1]?.kind === "directory" ? tree[1].children.map(node => `${node.kind}:${node.name}`) : [], ["directory:api", "file:index.ts"]);
  assert.deepEqual(tree[1]?.kind === "directory" ? tree[1].children[0] : null, { kind: "directory", name: "api", path: "src/api", children: [{ kind: "directory", name: "controllers", path: "src/api/controllers", children: [{ kind: "file", name: "index.ts", path: "src/api/controllers/index.ts", file: deep }] }] });
});

test("Git 状态映射按真实新增、删除、修改和重命名状态标记", () => {
  assert.deepEqual(["??", "A ", " D", "R ", "MM", "C "].map(workspaceGitStatusKind), ["added", "added", "deleted", "renamed", "modified", "modified"]);
  assert.deepEqual(["??", " D", "M "].map(workspaceGitStatusLabel), ["新增", "删除", "修改"]);
});

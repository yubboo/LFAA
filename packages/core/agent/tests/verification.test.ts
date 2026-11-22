// 验证完成前自检对代码路径与构建/测试命令的识别规则。
import assert from "node:assert/strict";
import test from "node:test";
import { isCodePath, isVerificationCommand } from "../src/run/verification";

test("识别需要验证的代码路径", () => {
  assert.equal(isCodePath("src/app.ts"), true);
  assert.equal(isCodePath("pom.xml"), true);
  assert.equal(isCodePath("styles/main.css"), true);
  assert.equal(isCodePath("README.md"), false);
  assert.equal(isCodePath("docs/guide.md"), false);
  assert.equal(isCodePath(undefined), false);
});

test("识别构建、测试与类型检查命令", () => {
  assert.equal(isVerificationCommand("pnpm build"), true);
  assert.equal(isVerificationCommand("pnpm run typecheck"), true);
  assert.equal(isVerificationCommand("tsc --noEmit"), true);
  assert.equal(isVerificationCommand("mvn clean package -DskipTests"), true);
  assert.equal(isVerificationCommand("go test ./..."), true);
  assert.equal(isVerificationCommand("dotnet build"), true);
  assert.equal(isVerificationCommand("git status"), false);
  assert.equal(isVerificationCommand("echo build"), false);
  assert.equal(isVerificationCommand("pnpm dev"), false);
  assert.equal(isVerificationCommand("   "), false);
});

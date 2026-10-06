#!/usr/bin/env node
/** 功能：执行 Typert Remote 静态合同生成。作用：写入确定的源码产物或检查生成物是否过期。 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateTypertRemoteContract } from "./index.mjs";

const values = parseArguments(process.argv.slice(2));
const sourcePath = resolve(process.cwd(), values.source);
const outputPath = resolve(process.cwd(), values.output);
const sourceText = await readFile(sourcePath, "utf8");
const generated = generateTypertRemoteContract({ sourceText, sourcePath, contractName: values.type });

if (values.check) {
  let current;
  try {
    current = await readFile(outputPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (current !== generated) {
    process.stderr.write(`Typert 生成物已过期：${outputPath}\n请在 ${dirname(outputPath)} 对应工作区包中运行生成命令。\n`);
    process.exitCode = 1;
  } else process.stdout.write(`Typert 生成物与源合同一致：${outputPath}\n`);
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generated, "utf8");
  process.stdout.write(`Typert 双端合同已生成：${outputPath}\n`);
}

function parseArguments(arguments_) {
  const values = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--check") {
      values.check = true;
      continue;
    }
    if (!["--source", "--type", "--output"].includes(argument)) throw new Error(`未知参数：${argument}`);
    const value = arguments_[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`缺少 ${argument} 的值。`);
    values[argument.slice(2)] = value;
    index += 1;
  }
  if (!values.source || !values.type || !values.output) {
    throw new Error("用法：lfaa-typert-generate --source <文件> --type <导出类型名> --output <生成文件> [--check]");
  }
  return values;
}

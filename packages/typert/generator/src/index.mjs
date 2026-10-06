/**
 * 功能：从 TypeScript Remote 类型合同生成双端描述与 JSON Schema。
 * 作用：让 Host 和 Client 消费同一份端点/输入/输出合同；不生成业务校验、认证或授权逻辑。
 */
import ts from "typescript";
import { resolve } from "node:path";

const jsonSchemaDraft = "https://json-schema.org/draft/2020-12/schema";

/**
 * 根据导出的 TypeScript Remote 映射生成可被 Host 和 Client 共用的源码。
 * 当前版本只接受自包含的导出类型别名，并对无法无损映射为 JSON 的类型失败关闭。
 * @param {{sourceText: string, sourcePath: string, contractName: string}} options
 */
export function generateTypertRemoteContract({ sourceText, sourcePath, contractName }) {
  if (!sourceText.trim()) throw new TypeError("Typert 类型合同不能为空。");
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(contractName)) throw new TypeError("Typert 合同类型名无效。");

  const absoluteSourcePath = resolve(sourcePath);
  const normalizedSourcePath = normalizePath(absoluteSourcePath);
  const compilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: true,
    noEmit: true
  };
  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (normalizePath(fileName) === normalizedSourcePath) {
      return ts.createSourceFile(fileName, sourceText, languageVersion, true, ts.ScriptKind.TS);
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };
  host.readFile = (fileName) => normalizePath(fileName) === normalizedSourcePath ? sourceText : originalReadFile(fileName);
  host.fileExists = (fileName) => normalizePath(fileName) === normalizedSourcePath || originalFileExists(fileName);

  const program = ts.createProgram([absoluteSourcePath], compilerOptions, host);
  const sourceFile = program.getSourceFile(absoluteSourcePath);
  if (!sourceFile) throw new Error(`无法读取 Typert 合同源文件：${absoluteSourcePath}`);
  if (sourceFile.parseDiagnostics.length) throw formatDiagnostics(sourceFile.parseDiagnostics);
  const forbiddenStatement = sourceFile.statements.find((statement) => !ts.isTypeAliasDeclaration(statement));
  if (forbiddenStatement) throw new TypeError("Typert 合同源文件只允许导出 TypeScript 类型别名；导入、值和运行时代码必须留在插件 Owner。");

  const aliases = sourceFile.statements;
  const contract = aliases.find((statement) => statement.name.text === contractName);
  if (!contract) throw new Error(`源文件未导出类型合同 ${contractName}。`);
  if (!hasExportModifier(contract)) throw new TypeError(`类型合同 ${contractName} 必须显式导出。`);
  for (const alias of aliases) {
    if (!hasExportModifier(alias)) throw new TypeError(`类型别名 ${alias.name.text} 必须显式导出。`);
  }

  const diagnostics = program.getSemanticDiagnostics(sourceFile);
  if (diagnostics.length) throw formatDiagnostics(diagnostics);
  const checker = program.getTypeChecker();
  const contractType = checker.getTypeAtLocation(contract);
  const endpointProperties = checker.getPropertiesOfType(contractType);
  if (!endpointProperties.length) throw new TypeError("Typert 合同至少要声明一个 Remote 方法。");

  const schemas = {};
  const methods = {};
  for (const endpointProperty of endpointProperties.sort((left, right) => left.getName().localeCompare(right.getName()))) {
    const endpoint = endpointProperty.getName();
    const segments = endpoint.split("/");
    if (segments.length !== 2 || segments.some((segment) => !/^[A-Za-z][A-Za-z0-9_.-]*$/u.test(segment))) {
      throw new TypeError(`Remote 端点 ${endpoint} 必须使用“命名空间/方法”格式。`);
    }
    const endpointType = checker.getTypeOfSymbolAtLocation(endpointProperty, endpointProperty.valueDeclaration ?? contract);
    const fields = new Map(checker.getPropertiesOfType(endpointType).map((property) => [property.getName(), property]));
    if (fields.size !== 2 || !fields.has("input") || !fields.has("output")) {
      throw new TypeError(`Remote ${endpoint} 必须且只能定义 input 与 output。`);
    }
    const inputSymbol = fields.get("input");
    const outputSymbol = fields.get("output");
    const inputType = checker.getTypeOfSymbolAtLocation(inputSymbol, inputSymbol.valueDeclaration ?? contract);
    const outputType = checker.getTypeOfSymbolAtLocation(outputSymbol, outputSymbol.valueDeclaration ?? contract);
    const inputSchema = toJsonSchema(inputType, checker, new Set(), `${endpoint}.input`);
    const outputSchema = toJsonSchema(outputType, checker, new Set(), `${endpoint}.output`);
    schemas[endpoint] = {
      input: { $schema: jsonSchemaDraft, ...inputSchema },
      output: { $schema: jsonSchemaDraft, ...outputSchema }
    };
    const [namespace, method] = segments;
    methods[endpoint] = { endpoint, namespace, method };
  }

  const stem = toLowerCamel(contractName.replace(/Contract$/u, ""));
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const generatedAliases = aliases.map((alias) => printer.printNode(ts.EmitHint.Unspecified, alias, sourceFile)).join("\n\n");
  const json = (value) => JSON.stringify(value, null, 2);
  return [
    "/** 此文件由 lfaa-typert-generate 自动生成；请修改源合同并重新生成，不要手工编辑。 */",
    generatedAliases,
    `export const ${stem}Methods = ${json(methods)} as const;`,
    `export const ${stem}Schemas = ${json(schemas)} as const;`,
    ""
  ].join("\n\n");
}

function toJsonSchema(type, checker, activeTypes, path) {
  const flags = type.flags;
  if (flags & ts.TypeFlags.StringLiteral) return { type: "string", const: type.value };
  if (flags & ts.TypeFlags.NumberLiteral) return { type: "number", const: type.value };
  if (flags & ts.TypeFlags.BooleanLiteral) return { type: "boolean", const: type.intrinsicName === "true" };
  if (flags & ts.TypeFlags.StringLike) return { type: "string" };
  if (flags & ts.TypeFlags.NumberLike) return { type: "number" };
  if (flags & ts.TypeFlags.BooleanLike) return { type: "boolean" };
  if (flags & ts.TypeFlags.Null) return { type: "null" };
  if (flags & ts.TypeFlags.Union) {
    return { anyOf: type.types.map((member) => toJsonSchema(member, checker, activeTypes, path)) };
  }
  if (flags & ts.TypeFlags.Intersection) throw unsupportedType(path, "交叉类型");
  if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Undefined | ts.TypeFlags.Void | ts.TypeFlags.Never | ts.TypeFlags.BigIntLike | ts.TypeFlags.TypeParameter)) {
    throw unsupportedType(path, checker.typeToString(type));
  }
  if (!(flags & ts.TypeFlags.Object)) throw unsupportedType(path, checker.typeToString(type));

  if (activeTypes.has(type)) throw unsupportedType(path, "递归类型");
  activeTypes.add(type);
  try {
    if (checker.isArrayType(type)) {
      const [elementType] = checker.getTypeArguments(type);
      return { type: "array", items: toJsonSchema(elementType, checker, activeTypes, `${path}[]`) };
    }
    if (checker.isTupleType(type)) throw unsupportedType(path, "元组");

    const properties = {};
    const required = [];
    for (const property of checker.getPropertiesOfType(type).sort((left, right) => left.getName().localeCompare(right.getName()))) {
      const name = property.getName();
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration ?? type.symbol?.valueDeclaration);
      properties[name] = toJsonSchema(propertyType, checker, activeTypes, `${path}.${name}`);
      if (!(property.flags & ts.SymbolFlags.Optional)) required.push(name);
    }
    const indexes = checker.getIndexInfosOfType(type);
    if (indexes.length > 1 || indexes.some((index) => !(index.keyType.flags & ts.TypeFlags.StringLike))) {
      throw unsupportedType(path, "非字符串或多重索引签名");
    }
    if (indexes.length === 1) {
      if (indexes[0].type.flags & ts.TypeFlags.Never) {
        return { type: "object", properties, required, additionalProperties: false };
      }
      return {
        type: "object",
        properties,
        required,
        additionalProperties: toJsonSchema(indexes[0].type, checker, activeTypes, `${path}.*`)
      };
    }
    return { type: "object", properties, required, additionalProperties: false };
  } finally {
    activeTypes.delete(type);
  }
}

function hasExportModifier(node) {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function formatDiagnostics(diagnostics) {
  return new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (fileName) => fileName,
    getNewLine: () => "\n"
  }));
}

function normalizePath(path) {
  return resolve(path).replaceAll("\\", "/").toLocaleLowerCase("en-US");
}

function toLowerCamel(value) {
  if (!value) throw new TypeError("生成物名称不能为空。");
  return value[0].toLocaleLowerCase("en-US") + value.slice(1);
}

function unsupportedType(path, kind) {
  return new TypeError(`Typert Remote ${path} 包含不支持或无法无损映射为 JSON Schema 的类型：${kind}。`);
}

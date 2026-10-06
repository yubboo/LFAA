# Typert TypeScript 生成器

`lfaa-typert-generator` 是工程期工具，不进入产品运行树。它读取显式导出的 Remote 类型映射，生成供 Host 和 Client 共用的端点常量与 JSON Schema，并保留同一份 TypeScript 输入/输出类型。

## 使用方式

账户控制器的源合同位于 `packages/api/account-controller/src/client-contract.ts`。在该包目录运行：

```powershell
pnpm run generate:remote
pnpm run generate:remote -- --check
```

生成文件为 `client-contract.generated.ts`。Host 与 Client 都从这个文件导入端点描述和方法类型，避免手工重复路径或输入/输出类型。

## 输入限制

- 源文件只包含导出的 TypeScript 类型别名，不接受导入、运行时代码或副作用。
- Remote 映射的每个方法必须且只能声明 `input` 与 `output`，端点格式为 `命名空间/方法`。
- 支持 JSON 标量、字面量、联合类型、对象、数组和字符串键 `Record`。`any`、`unknown`、`undefined`、函数、交叉/递归类型、元组及不能无损表达的索引键会直接报错。
- 生成的 JSON Schema 描述数据形状，不替代 Host 的运行时解析器、认证、逐方法授权或业务约束。协议层仍会检查 JSON 可传输性并限制单次输入/输出总计 4 MiB。

新增工作区包接入时，将自身 Remote 类型合同交给生成器并让真实 Host/Client 消费生成物；不得仅因生成文件存在就标记该能力完成。

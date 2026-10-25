# spill-local

提供 `SpillStore` 的本机文件实现。每个 `createLocalSpillStore()` 实例只读取自己创建且尚未清理的会话文件；存储根目录使用 LFAA 的私有目录权限策略，会话目录由 `mkdtemp()` 独立创建，文件以仅当前用户可读写的模式创建。`SpillRef.location` 返回随机不透明 ID，真实本机路径只保存在当前 Store 的内存映射中。`readRange()` 使用稀疏 UTF-8 字节偏移索引和流式回读，单次最多返回 16,384 个 Unicode 字符，不将大文件整体读入模型工具的读取内存。

此包只负责存储和会话目录清理，不决定何时外置结果、不把引用注入模型上下文，也不提供 Agent 可调用的读取工具。Agent Loop 尚未接入此存储能力。

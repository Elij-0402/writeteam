# 贡献指南

## 开发原则

- 变更应最小化并对齐现有架构。
- 修复根因，不做表层补丁。
- 不引入 `as any`、`@ts-ignore`、`@ts-expect-error`。

## 代码约定

- 内部模块使用 `@/*` 别名导入。
- 保持 TypeScript 严格类型与 `import type` 习惯。
- 保持中文用户文案（zh-CN）。

## 提交流程建议

1. 先运行受影响测试。
2. 再运行：

```bash
npm run lint
npm run build
npm run test
```

3. 确认无密钥/敏感信息泄露。

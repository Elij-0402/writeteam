# 技术栈分析

| 类别 | 技术 | 版本 | 依据 |
|---|---|---|---|
| 框架 | Next.js | 16.1.6 | `package.json` |
| UI | React | 19.2.3 | `package.json` |
| 语言 | TypeScript | ^5 | `package.json` + `tsconfig.json` |
| 样式 | Tailwind CSS | ^4 | `package.json` |
| UI 组件体系 | shadcn/ui | ^3.8.5 | `package.json` + `components.json` |
| 数据与鉴权 | Supabase | `@supabase/supabase-js` ^2.97.0 | `package.json` + `src/lib/supabase/*` |
| 富文本编辑 | TipTap | ^3.20.0 | `package.json` |
| AI SDK | AI SDK + OpenAI Compatible | `ai` ^6.0.100 | `package.json` + `src/app/api/ai/*` |
| 测试 | Vitest | ^3.2.4 | `package.json` + `vitest.config.ts` |
| 合同测试 | Node test runner | node --test | `scripts/run-tests.mjs` + `tests/*.mjs` |

## 结论

- 主体为 **Next.js App Router 单仓全栈应用**。
- 采用 **Supabase + Server Actions + API Routes** 的混合后端形态。

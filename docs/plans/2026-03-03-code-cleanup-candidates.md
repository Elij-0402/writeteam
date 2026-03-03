# 2026-03-03 保守代码清洁候选与结果

## 规则
- 仅删除可证明未使用项
- 保留 legacy 兼容逻辑
- 不删除旧测试文件

## 已执行批次

| path/symbol | evidence | action | status |
| --- | --- | --- | --- |
| `src/components/layout/welcome-page.tsx` | `rg -n "WelcomePage" src` 仅定义处，无任何引用 | 删除文件 | 已完成 |
| `src/components/providers/auth-provider.tsx#useAuth` | `rg -n "useAuth\\b" src` 仅定义处，无引用 | 删除导出与对应 import | 已完成 |
| `src/app/actions/documents.ts#getDocuments` | `rg -n "getDocuments\\b" src` 无调用（仅编辑器内部同名方法） | 删除函数 | 已完成 |
| `src/app/actions/documents.ts#getDocument` | `rg -n "getDocument\\b" src` 无调用 | 删除函数 | 已完成 |
| `src/lib/ai/consistency-metrics.ts#createConsistencyTelemetry` | `rg -n` 无引用 | 删除函数 | 已完成 |
| `src/lib/ai/consistency-metrics.ts#recordConflict` | `rg -n` 无引用 | 删除函数 | 已完成 |
| `src/lib/ai/consistency-metrics.ts#recordAcceptedRepair` | `rg -n` 无引用 | 删除函数 | 已完成 |
| `src/lib/ai/consistency-metrics.ts#recordFallback` | `rg -n` 无引用 | 删除函数 | 已完成 |
| `src/lib/ai/openai-stream.ts#TelemetryOptions.consistencyTelemetry` | `rg -n "consistencyTelemetry" src` 仅定义处，无读取 | 删除字段与 type import | 已完成 |
| `src/types/database.ts#Profile` | `rg -n "\\bProfile\\b" src` 仅定义处 | 删除类型导出 | 已完成 |
| `src/types/database.ts#AIHistory` | `rg -n "\\bAIHistory\\b" src` 仅定义处 | 删除类型导出 | 已完成 |
| `src/app/actions/projects.ts#getProjects` | `rg -n "\\bgetProjects\\b" src` 仅定义处 | 删除函数 | 已完成 |
| `src/app/actions/series.ts#getSeries` | `rg -n "\\bgetSeries\\b" src` 仅定义处 | 删除函数 | 已完成 |
| `src/app/actions/story-bible.ts#getStoryBibleConsistencyFlags` | `rg -n "\\bgetStoryBibleConsistencyFlags\\b" src` 仅定义处 | 删除函数 | 已完成 |
| `src/app/actions/story-bible.ts#getStoryBible` | `rg -n "\\bgetStoryBible\\b" src` 仅定义处 | 删除函数 | 已完成 |
| `src/app/actions/story-bible.ts#getCharacters` | `rg -n "\\bgetCharacters\\b" src` 仅定义处 | 删除函数 | 已完成 |
| `src/app/actions/story-bible.ts#getConsistencyFeatureFlags import` | lint 提示未使用 | 删除 import | 已完成 |
| `src/lib/ai/consistency-preflight.ts` exported internal-only types | `rg` 全局仅在模块内出现 | 移除 `export`（4 个类型） | 已完成 |
| `src/lib/ai/consistency-metrics.ts#ConflictMetricsInput` | `rg` 全局仅在模块内出现 | 移除 `export` | 已完成 |
| `src/lib/ai/saliency.ts#CharacterInfo` | `rg` 全局仅在模块内出现 | 移除 `export` | 已完成 |
| `src/components/layout/*` props interfaces (`SiteHeaderProps`/`ProjectTreeProps`/`NavUserProps`/`AISidebarProps`/`AppShellProps`/`AppSidebarProps`) | 全局检索仅模块内使用 | 移除 `export` | 已完成 |
| `src/components/ai/chat-mentions.tsx#ChatMentionsProps` | `rg` 全局仅在模块内出现 | 移除 `export` | 已完成 |
| `src/components/ai/prose-mode-selector.tsx#ProseMode` | `rg` 全局仅在模块内出现 | 移除 `export` | 已完成 |
| `src/components/story-bible/conflict-workbench.tsx#ConflictWorkbenchItem` | `rg` 全局仅在模块内出现 | 移除 `export` | 已完成 |
| `src/lib/ai/continuity-result.ts` internal-only types (`EvidenceSource`/`ContinuityActionTarget`/`ContinuityAction`) | `rg` 全局仅在模块内出现 | 移除 `export` | 已完成 |
| `src/lib/ai/feature-groups.ts` internal-only constants (`WRITING_FEATURES`/`PLANNING_FEATURES`/`CHECK_FEATURES`) | `rg` 全局仅在模块内出现 | 移除 `export` | 已完成 |
| `src/lib/ai/story-context.ts` internal-only types (`StoryBibleData`/`CharacterData`/`StoryPromptOptions`/`StoryPromptContext`) | `rg` 全局仅在模块内出现 | 移除 `export` | 已完成 |
| `src/lib/ai/structured-context.ts#StructuredContextVisibility` | `rg` 全局仅在模块内出现 | 移除 `export` | 已完成 |

## 验证
- `npm run lint`: 通过（0 error，2 warning）
- `npm run test`: 通过（19 files, 150 tests）

## 备注
- 为避免对历史编码文本做风险性改写，针对 `react/no-unescaped-entities` 在以下文件使用了文件级 lint 规则关闭：
  - `src/components/editor/editor-shell.tsx`
  - `src/components/layout/app-sidebar.tsx`


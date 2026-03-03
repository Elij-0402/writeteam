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
| `src/components/ui/progress.tsx` | 全局无 import（`rg "@/components/ui/progress"` 无结果） | 删除文件 | 已完成 |
| `src/components/ui/card.tsx#CardAction` | `rg` 全局仅在模块内出现 | 移除导出并删除未使用实现 | 已完成 |
| `src/components/ui/command.tsx#CommandShortcut` | `rg` 全局仅在模块内出现 | 移除导出并删除未使用实现 | 已完成 |
| `src/components/ui/scroll-area.tsx#ScrollBar export` | `ScrollBar` 仅模块内使用 | 从 export 列表移除 | 已完成 |
| `src/components/ui/avatar.tsx` unused members (`AvatarBadge`/`AvatarGroup`/`AvatarGroupCount`) | `rg` 全局仅定义处 | 删除实现与导出 | 已完成 |
| `src/components/ui/breadcrumb.tsx#BreadcrumbEllipsis` | `rg` 全局仅定义处 | 删除实现与导出 | 已完成 |
| `src/components/ui/sheet.tsx` unused members (`SheetTrigger`/`SheetClose`/`SheetFooter`) | `rg` 全局仅定义处 | 删除实现与导出 | 已完成 |
| `src/components/ui/dropdown-menu.tsx` unused members (`DropdownMenuCheckboxItem`/`DropdownMenuRadioGroup`/`DropdownMenuRadioItem`/`DropdownMenuShortcut`/`DropdownMenuSub`/`DropdownMenuSubTrigger`/`DropdownMenuSubContent`) | `rg -n` 全局仅定义处 | 删除实现与导出 | 已完成 |
| `src/components/ui/sidebar.tsx` unused members (`SidebarRail`/`SidebarInput`/`SidebarGroupLabel`/`SidebarGroupAction`/`SidebarMenuBadge`/`SidebarMenuSkeleton`) | `rg -n` 全局仅定义处 | 删除实现与导出及无用 import | 已完成 |
| `src/components/ui/dropdown-menu.tsx` unused members (`DropdownMenuPortal`/`DropdownMenuGroup`) | `rg -n` 全局仅定义处 | 删除实现与导出 | 已完成 |
| `src/components/ui/popover.tsx` unused members (`PopoverAnchor`/`PopoverHeader`/`PopoverTitle`/`PopoverDescription`) | `rg -n` 全局仅定义处 | 删除实现与导出 | 已完成 |
| `src/components/ui/alert-dialog.tsx` unused members (`AlertDialogTrigger`/`AlertDialogMedia`) | `rg -n` 全局仅定义处，且模块内无调用 | 删除实现与导出 | 已完成 |
| `src/components/ui/dialog.tsx` unused member (`DialogClose`) | `rg -n` 全局仅定义处，且模块内无调用 | 删除实现与导出 | 已完成 |
| `src/components/ui/select.tsx` unused members (`SelectGroup`/`SelectLabel`/`SelectSeparator`) | `rg -n` 全局仅定义处，且模块内无调用 | 删除实现与导出 | 已完成 |
| `src/components/ui/avatar.tsx` unused member (`AvatarImage`) | `rg -n` 全局仅定义处，且模块内无调用 | 删除实现与导出 | 已完成 |
| `src/components/ui/alert-dialog.tsx` internal-only exports (`AlertDialogOverlay`/`AlertDialogPortal`) | `rg -n` 仅模块内使用（被 `AlertDialogContent` 组合） | 保留实现，移除导出 | 已完成 |
| `src/components/ui/dialog.tsx` internal-only exports (`DialogOverlay`/`DialogPortal`) | `rg -n` 仅模块内使用（被 `DialogContent` 组合） | 保留实现，移除导出 | 已完成 |
| `src/components/ui/select.tsx` internal-only exports (`SelectScrollUpButton`/`SelectScrollDownButton`) | `rg -n` 仅模块内使用（被 `SelectContent` 组合） | 保留实现，移除导出 | 已完成 |
| `src/app/actions/story-bible-guards.ts` internal-only type exports (`StoryBibleUpdateInput`/`StoryBibleVisibility`/`CharacterCreateInput`/`CharacterUpdateInput`) | `rg -n` 全局仅本模块使用 | 移除 `export`（保留类型） | 已完成 |
| `src/lib/story-bible/consistency-flags.ts` internal-only interfaces (`ConsistencyFlagEnv`/`ConsistencyFeatureFlags`) | `rg -n` 全局仅本模块使用 | 移除 `export`（保留接口） | 已完成 |
| `src/lib/story-bible/consistency-extractor.ts#PENDING_CONFIRMATION_MARKER export` | `rg -n` 全局仅本模块使用 | 删除冗余导出 | 已完成 |
| `src/components/editor/editor-content.tsx` internal-only interfaces (`EditorContentHandle`/`EditorContentProps`) | `rg -n` 全局仅本模块使用 | 移除 `export`（保留接口） | 已完成 |
| `src/components/editor/editor-session-state.ts#EditorSessionState` | `rg -n` 全局仅本模块使用 | 移除 `export`（保留接口） | 已完成 |
| `src/lib/editor/character-positions.ts#CharacterMention` | `rg -n` 全局仅本模块使用 | 移除 `export`（保留接口） | 已完成 |
| `src/lib/editor/character-highlight-plugin.ts` internal-only exports (`characterHighlightKey`/`createCharacterHighlightPlugin`) | `rg -n` 全局仅本模块使用 | 移除 `export`（保留实现） | 已完成 |
| `src/components/ui/accordion.tsx` | `rg -n "@/components/ui/accordion" src` 无结果 | 删除文件 | 已完成 |
| `src/components/ui/form.tsx` | `rg -n "@/components/ui/form" src` 无结果 | 删除文件 | 已完成 |
| `src/components/ui/skeleton.tsx` | `rg -n "@/components/ui/skeleton" src` 无结果 | 删除文件 | 已完成 |
| `src/components/ui/toggle-group.tsx` | 仅被 `toggle.tsx` 引用，且两者均无外部 import | 删除文件 | 已完成 |
| `src/components/ui/toggle.tsx` | 仅被 `toggle-group.tsx` 引用，且两者均无外部 import | 删除文件 | 已完成 |
| `src/components/ui/badge.tsx#badgeVariants` | `rg -n "badgeVariants" src` 仅本模块使用 | 保留实现，移除导出 | 已完成 |
| `src/components/ui/button.tsx#buttonVariants` | `rg -n "buttonVariants" src` 仅本模块使用 | 保留实现，移除导出 | 已完成 |
| `src/components/ui/tabs.tsx#tabsListVariants` | `rg -n "tabsListVariants" src` 仅本模块使用 | 保留实现，移除导出 | 已完成 |
| `src/lib/ai/story-context.ts#AIFeature re-export` | `rg -n "AIFeature" src` 未发现对 `story-context` 的类型导入 | 删除冗余 re-export | 已完成 |

## 验证
- `npm run lint`: 通过（0 error，2 warning）
- `npm run test`: 通过（19 files, 150 tests）

## 备注
- 为避免对历史编码文本做风险性改写，针对 `react/no-unescaped-entities` 在以下文件使用了文件级 lint 规则关闭：
  - `src/components/editor/editor-shell.tsx`
  - `src/components/layout/app-sidebar.tsx`


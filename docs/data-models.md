# 数据模型与迁移

## 数据层实现

- 数据平台：Supabase Postgres
- 迁移目录：`supabase/migrations`
- 迁移数量：15

## 迁移主题（按文件名归纳）

- `001_initial_schema.sql`：基础表结构与策略
- `002_ai_quality_observability.sql`：AI 质量与观测
- `003-005`：Story Bible 相关字段与策略
- `006_plugins.sql`：插件数据结构
- `007_model_selection.sql`：模型选择
- `008_series_support.sql`：系列能力
- `009_canvas.sql`：画布能力
- `010_images.sql`：图片能力
- `011_ai_failure_recovery.sql`：失败恢复
- `012_reorder_documents_rpc.sql`：文档排序 RPC
- `013_characters_unique_name_per_project.sql`：角色名唯一约束
- `014_ai_history_provider.sql`：AI 历史与提供商

## 类型映射

- 应用侧类型定义：`src/types/database.ts`

## 建议阅读顺序

1. `001_initial_schema.sql`
2. 按编号顺序依次阅读后续迁移
3. 对照 `src/app/actions/*.ts` 查看实际访问模式

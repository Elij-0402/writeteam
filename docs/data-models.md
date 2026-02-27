# WriteTeam — 数据模型文档

> 生成日期: 2026-02-27 | 数据库: Supabase Postgres | 迁移: 001-010

## 概览

- **12 张表**, **1 个函数**, **1 个触发器**
- **4 个 CHECK 约束**, **2 个 UNIQUE 约束** (除 PK 外)
- **18+ 显式索引**, **44 条 RLS 策略**
- 所有表强制 `user_id = auth.uid()` 行级安全

---

## 完整表结构

### 1. `public.profiles`

用户个人资料。由 `handle_new_user()` 触发器在注册时自动创建。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, FK → auth.users(id) CASCADE |
| `email` | text | NOT NULL |
| `full_name` | text | nullable |
| `avatar_url` | text | nullable |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() |

**RLS**: SELECT own, INSERT own, UPDATE own (无 DELETE)
**触发器**: `on_auth_user_created` → `handle_new_user()` (SECURITY DEFINER)

---

### 2. `public.projects`

写作项目。创建时自动生成 story_bible + 第一章。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, DEFAULT gen_random_uuid() |
| `user_id` | uuid | NOT NULL, FK → auth.users CASCADE |
| `title` | text | NOT NULL |
| `description` | text | nullable |
| `genre` | text | nullable |
| `cover_image_url` | text | nullable |
| `word_count_goal` | integer | nullable |
| `preferred_model` | text | DEFAULT 'gpt-4o-mini' |
| `series_id` | uuid | FK → series(id) SET NULL, nullable |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() |

**索引**: `idx_projects_user_id`, `idx_projects_series_id`
**RLS**: 完整 CRUD

---

### 3. `public.documents`

文档/章节。内容以 TipTap JSON 存储，带纯文本镜像。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, DEFAULT gen_random_uuid() |
| `project_id` | uuid | NOT NULL, FK → projects CASCADE |
| `user_id` | uuid | NOT NULL, FK → auth.users CASCADE |
| `title` | text | NOT NULL, DEFAULT 'Untitled' |
| `content` | jsonb | nullable (TipTap JSON) |
| `content_text` | text | nullable (纯文本镜像) |
| `word_count` | integer | DEFAULT 0 |
| `sort_order` | integer | DEFAULT 0 |
| `document_type` | text | DEFAULT 'chapter', CHECK IN ('chapter','scene','note','draft') |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() |

**索引**: `idx_documents_project_id`, `idx_documents_user_id`
**RLS**: 完整 CRUD

---

### 4. `public.characters`

角色资料。支持项目级和系列级归属。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, DEFAULT gen_random_uuid() |
| `project_id` | uuid | NOT NULL, FK → projects CASCADE |
| `user_id` | uuid | NOT NULL, FK → auth.users CASCADE |
| `name` | text | NOT NULL |
| `role` | text | nullable |
| `description` | text | nullable |
| `personality` | text | nullable |
| `appearance` | text | nullable |
| `backstory` | text | nullable |
| `goals` | text | nullable |
| `relationships` | text | nullable |
| `notes` | text | nullable |
| `series_id` | uuid | FK → series(id) SET NULL, nullable |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() |

**索引**: `idx_characters_project_id`, `idx_characters_series_id`
**RLS**: 完整 CRUD

---

### 5. `public.story_bibles`

故事圣经。每个项目一个 (UNIQUE)。14+ 个创作字段。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, DEFAULT gen_random_uuid() |
| `project_id` | uuid | NOT NULL, FK → projects CASCADE, **UNIQUE** |
| `user_id` | uuid | NOT NULL, FK → auth.users CASCADE |
| `braindump` | text | nullable |
| `genre` | text | nullable |
| `style` | text | nullable |
| `synopsis` | text | nullable |
| `themes` | text | nullable |
| `setting` | text | nullable |
| `pov` | text | nullable |
| `tense` | text | nullable |
| `worldbuilding` | text | nullable |
| `outline` | jsonb | nullable |
| `notes` | text | nullable |
| `prose_mode` | text | DEFAULT 'balanced', CHECK IN ('balanced','cinematic','lyrical','minimal','match-style') |
| `style_sample` | text | nullable |
| `tone` | text | nullable |
| `ai_rules` | text | nullable |
| `visibility` | jsonb | DEFAULT '{}' |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() |

**索引**: `idx_story_bibles_project_id`
**RLS**: 完整 CRUD

---

### 6. `public.ai_history`

AI 使用遥测日志。仅追加 (无 UPDATE/DELETE)。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, DEFAULT gen_random_uuid() |
| `user_id` | uuid | NOT NULL, FK → auth.users CASCADE |
| `project_id` | uuid | NOT NULL, FK → projects CASCADE |
| `document_id` | uuid | FK → documents(id) SET NULL |
| `feature` | text | NOT NULL |
| `prompt` | text | NOT NULL |
| `result` | text | NOT NULL |
| `model` | text | nullable |
| `tokens_used` | integer | nullable |
| `latency_ms` | integer | nullable |
| `output_chars` | integer | nullable |
| `response_fingerprint` | text | nullable |
| `user_rating` | smallint | nullable, CHECK (IS NULL OR IN (-1, 1)) |
| `rated_at` | timestamptz | nullable |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |

**索引**: `idx_ai_history_project_id`, `idx_ai_history_user_id`, `idx_ai_history_fingerprint`, `idx_ai_history_user_rating`
**RLS**: SELECT own, INSERT own (无 UPDATE/DELETE)

---

### 7. `public.plugins`

用户自定义 AI 工具。project_id nullable 支持全局插件。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, DEFAULT gen_random_uuid() |
| `user_id` | uuid | NOT NULL, FK → auth.users CASCADE |
| `project_id` | uuid | FK → projects CASCADE, nullable |
| `name` | text | NOT NULL |
| `description` | text | nullable |
| `system_prompt` | text | NOT NULL |
| `user_prompt_template` | text | NOT NULL |
| `requires_selection` | boolean | DEFAULT false |
| `max_tokens` | integer | DEFAULT 1000 |
| `temperature` | numeric(3,2) | DEFAULT 0.7 |
| `icon` | text | nullable |
| `sort_order` | integer | DEFAULT 0 |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() |

**索引**: `idx_plugins_user_id`, `idx_plugins_project_id`
**RLS**: 完整 CRUD

---

### 8. `public.series`

书籍系列。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, DEFAULT gen_random_uuid() |
| `user_id` | uuid | NOT NULL, FK → auth.users CASCADE |
| `title` | text | NOT NULL |
| `description` | text | nullable |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() |

**索引**: `idx_series_user_id`
**RLS**: 完整 CRUD

---

### 9. `public.series_bibles`

系列级故事圣经。每个系列一个 (UNIQUE)。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, DEFAULT gen_random_uuid() |
| `series_id` | uuid | NOT NULL, FK → series CASCADE, **UNIQUE** |
| `user_id` | uuid | NOT NULL, FK → auth.users CASCADE |
| `genre` | text | nullable |
| `style` | text | nullable |
| `themes` | text | nullable |
| `setting` | text | nullable |
| `worldbuilding` | text | nullable |
| `notes` | text | nullable |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() |

**索引**: `idx_series_bibles_series_id`
**RLS**: 完整 CRUD

---

### 10. `public.canvas_nodes`

画布节点 (可视化规划)。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, DEFAULT gen_random_uuid() |
| `project_id` | uuid | NOT NULL, FK → projects CASCADE |
| `user_id` | uuid | NOT NULL, FK → auth.users CASCADE |
| `node_type` | text | NOT NULL, DEFAULT 'beat', CHECK IN ('beat','scene','character','location','note') |
| `label` | text | NOT NULL |
| `content` | text | nullable |
| `position_x` | float | DEFAULT 0 |
| `position_y` | float | DEFAULT 0 |
| `width` | float | DEFAULT 200 |
| `height` | float | DEFAULT 100 |
| `color` | text | nullable |
| `metadata` | jsonb | nullable |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() |

**索引**: `idx_canvas_nodes_project`
**RLS**: 完整 CRUD

---

### 11. `public.canvas_edges`

画布边 (节点间连接)。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, DEFAULT gen_random_uuid() |
| `project_id` | uuid | NOT NULL, FK → projects CASCADE |
| `user_id` | uuid | NOT NULL, FK → auth.users CASCADE |
| `source_node_id` | uuid | NOT NULL, FK → canvas_nodes CASCADE |
| `target_node_id` | uuid | NOT NULL, FK → canvas_nodes CASCADE |
| `label` | text | nullable |
| `edge_type` | text | nullable |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |

**索引**: `idx_canvas_edges_project`
**RLS**: 完整 CRUD

---

### 12. `public.images`

AI 生成的图像。不可变 (无 UPDATE)。

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | uuid | **PK**, DEFAULT gen_random_uuid() |
| `project_id` | uuid | NOT NULL, FK → projects CASCADE |
| `user_id` | uuid | NOT NULL, FK → auth.users CASCADE |
| `prompt` | text | NOT NULL |
| `image_url` | text | NOT NULL |
| `style` | text | nullable |
| `source_text` | text | nullable |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |

**索引**: `idx_images_project`
**RLS**: SELECT own, INSERT own, DELETE own (无 UPDATE)

---

## 迁移历史

| # | 文件 | 内容 |
|---|------|------|
| 001 | initial_schema.sql | 基础 6 表 + handle_new_user 触发器 |
| 002 | ai_quality_observability.sql | ai_history 遥测字段 |
| 003 | story_bible_prose_mode.sql | prose_mode + style_sample |
| 004 | story_bible_tone_ai_rules.sql | tone + ai_rules |
| 005 | story_bible_visibility.sql | visibility (jsonb) |
| 006 | plugins.sql | plugins 表 |
| 007 | model_selection.sql | projects.preferred_model |
| 008 | series_support.sql | series + series_bibles 表 + FK |
| 009 | canvas.sql | canvas_nodes + canvas_edges |
| 010 | images.sql | images 表 |

## 系列继承机制

项目级 story_bible 从 series_bible 继承以下字段作为 fallback:
`genre`, `style`, `themes`, `setting`, `worldbuilding`, `notes`

继承在 `fetchStoryContext()` 中实现: 当项目有 `series_id` 时，查询 series_bibles 并将非空字段作为项目级字段的默认值。

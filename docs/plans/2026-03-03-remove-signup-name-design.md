# 移除登录注册页面中的姓名字段（设计文档）

日期：2026-03-03  
状态：已评审（用户确认）

## 1. 背景与目标

当前认证页面中，`/login` 仅需邮箱和密码，而 `/signup` 额外要求填写姓名（`fullName`），并在注册时写入 Supabase `full_name` 元数据。该差异增加了注册步骤，且对核心功能（写作与登录）不是必需。

本次目标：移除注册链路中的姓名输入与写入逻辑，保持认证流程最小化、一致化。

## 2. 范围

### In Scope
- 移除注册页姓名输入控件
- 移除服务端 `signUp` 对 `fullName` 的读取
- 移除注册请求中 `full_name` 元数据写入

### Out of Scope
- 不修改数据库 Schema
- 不做历史用户 `full_name` 数据清理或回填
- 不调整登录逻辑、会话逻辑、权限逻辑

## 3. 方案对比

### 方案 A（推荐）：前后端都移除姓名
- 内容：UI 不展示姓名；Server Action 不读取 `fullName`，不再写入 `full_name`
- 优点：前后端语义一致、实现最简、维护成本最低
- 缺点：历史 `full_name` 仍然存在（但不再新增）

### 方案 B：只移除前端输入
- 内容：UI 隐藏姓名，后端仍保留 `fullName` 处理
- 优点：改动最小
- 缺点：逻辑不一致，后续易产生理解偏差

### 方案 C：保留后端默认写入
- 内容：不让用户输入，但后端继续写空值/默认值
- 优点：兼容保守
- 缺点：产生无意义元数据，不符合 YAGNI

结论：采用方案 A。

## 4. 架构与组件设计

受影响文件：
- `src/app/(auth)/signup/page.tsx`
- `src/app/actions/auth.ts`

具体变更：
- `signup/page.tsx`：删除“姓名”对应 `Label + Input`（`name="fullName"`）
- `actions/auth.ts`：
  - 删除 `const fullName = formData.get("fullName")`
  - `supabase.auth.signUp` 仅传递 `email`、`password`
  - 删除 `options.data.full_name` 写入

不变项：
- 超时保护 `withTimeout`
- 错误映射 `mapAuthError`
- `revalidatePath` 与重定向流程

## 5. 数据流

### 变更前
1. 用户提交 `fullName + email + password`
2. `signUp` 读取 `fullName`
3. 调用 Supabase 时写入 `options.data.full_name`

### 变更后
1. 用户提交 `email + password`
2. `signUp` 仅读取邮箱与密码
3. 调用 Supabase 不带姓名元数据

## 6. 错误处理

- 不新增错误分支
- 保持现有中文错误提示一致
- 仍按现有规则处理：超时、网络异常、重复注册、密码长度问题

## 7. 测试与验收

### 手动验收
- 注册页不再显示“姓名”输入项
- 正常注册后仍跳转 `/dashboard`
- 异常场景提示文案保持原有行为

### 自动化验证（建议）
- 运行与认证相关的最小测试集合（若仓库已有对应测试）
- 至少执行一次 lint，确保无遗留未使用变量/导入

## 8. 风险与回滚

风险较低，主要是前后端字段不一致导致的潜在类型或校验遗漏。通过同步删除 UI 和 Server Action 字段可规避。

回滚方式：
- 恢复 `signup` 页面姓名输入
- 恢复 `signUp` 中 `fullName` 读取与 `full_name` 写入

## 9. 成功标准

- 注册表单字段缩减为邮箱和密码
- 服务端不再处理姓名字段
- 无新增认证错误或回归

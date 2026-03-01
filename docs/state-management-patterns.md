# 状态管理模式

## 客户端状态

- React Hooks：`useState`、`useEffect`、`useCallback`
- Provider 模式：
  - `src/components/providers/auth-provider.tsx`
  - `src/components/providers/ai-config-provider.tsx`
  - `src/components/providers/theme-provider.tsx`

## 编辑器状态

- 富文本编辑状态由 TipTap 相关组件管理：`src/components/editor/*`
- Canvas 状态由画布组件及相关 hook 管理：`src/components/canvas/*`

## 服务端状态边界

- 持久状态在 Supabase。
- 通过 Server Actions 与 API 路由完成读写。

## 结论

- 采用“轻量客户端状态 + 服务端权威数据”的混合策略。

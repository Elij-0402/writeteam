# Phase 4: 实施

## 目的

按 Stories 执行开发，通过质量门控确保代码质量，最终集成交付。

## 涉及角色

- **Team Lead** — Sprint 管理、任务分配
- **前端开发** — 组件实现
- **后端开发** — API 和数据层实现
- **QA 工程师** — 质量验证
- **中文语言专家** — 最终文案审查

## 步骤

### 1. Sprint 规划

Team Lead 执行：
- 将 Stories 转化为 Tasks（使用 TaskCreate）
- 设置任务依赖（使用 TaskUpdate addBlockedBy）
- 分配任务给对应角色
- 确定 Sprint 目标

### 2. 并行开发

按依赖关系并行执行：
- 前端开发实现组件
- 后端开发实现 API / server actions
- 每完成一个 Task 标记为 completed

### 3. 质量门

QA 工程师在每个 Story 完成后执行：

```bash
npm run lint         # ESLint 检查
npm run build        # 生产构建
```

检查清单：
- [ ] lint 通过
- [ ] build 通过
- [ ] Auth check 存在
- [ ] RLS 正确
- [ ] 无 `as any` / `@ts-ignore`
- [ ] 中文文案规范

### 4. 集成验证

- 确认所有 Stories 集成后功能完整
- 中文语言专家做最终文案审查
- QA 工程师做最终 lint + build

### 5. 交付汇报

Team Lead 向用户汇报：
- 完成的功能
- 修改的文件清单
- 已知限制或后续工作

## 产出物

- 已实现的代码
- 通过 lint + build 的验证结果
- 交付报告

## 完成标准

- [ ] 所有 Tasks 状态为 completed
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过
- [ ] 中文文案审查通过
- [ ] 用户确认功能符合预期

# Story 2.3 Autosave Manual Verification (Playwright)

- Date: 2026-02-27 (UTC, from browser automation logs)
- Environment: local app `http://127.0.0.1:3000`, existing authenticated session reused
- Scope: AC-related manual evidence for Task 4.3 / 4.4 / 4.5

## App availability and session evidence

- Local app check: `curl -I http://127.0.0.1:3000` returned `HTTP/1.1 200 OK`.
- Login/signup was not required in this run because browser already had a valid authenticated session and directly entered `/dashboard`.

## Scenario A - Continuous input + panel toggle + autosave state

- Result: PASS
- Steps executed:
  - Opened `QA-项目A` editor (`/editor/6db028e2-bc11-4cb4-a36a-d5c981ce72f0`).
  - Typed continuously into `.ProseMirror` including marker text:
    - `[验证A3] 连续输入第一段，观察自动保存状态。`
    - `[验证A3] 切换面板后继续输入第二段，检查无中断。`
  - Toggled right panel buttons `灵感` and `可视化`, then resumed typing.
- Observed UI/state evidence:
  - Autosave status line observed as `已保存 03:05:53`.
  - Autosave baseline indicator observed as `自动保存已启用（1 秒）`.
  - Word counter progressed to `字数 6` during this scenario.
  - Editor retained appended marker text after panel toggles.
- Artifact paths:
  - `_bmad-output/implementation-artifacts/evidence-story-2-3-autosave-2026-02-28/scenario-a-baseline.png`
  - `_bmad-output/implementation-artifacts/evidence-story-2-3-autosave-2026-02-28/scenario-a-after-input-toggle.png`
  - `_bmad-output/implementation-artifacts/evidence-story-2-3-autosave-2026-02-28/scenario-a-saved-after-toggle.png`
  - `_bmad-output/implementation-artifacts/evidence-story-2-3-autosave-2026-02-28/scenario-a-snapshot.md`
  - `_bmad-output/implementation-artifacts/evidence-story-2-3-autosave-2026-02-28/scenario-a-network.txt`

## Scenario B - Failure feedback and retry affordance

- Result: PASS
- Steps executed:
  - Forced browser offline (`net::ERR_INTERNET_DISCONNECTED`) and edited content with marker:
    - `[验证B-失败阶段] 触发离线保存失败，内容应保留。`
  - Clicked `立即重试` while still offline.
  - Restored online and clicked `立即重试` again.
- Observed UI/state evidence (offline):
  - `保存文档失败，请检查网络后重试`
  - `自动保存失败，可继续编辑`
  - `立即重试`
  - Marker text remained in editor content (no content loss).
- Observed UI/state evidence (online retry):
  - Status changed to `已保存 03:06:20` (and later `已保存 03:06:45` in follow-up screenshot capture).
  - Retry button no longer present after successful save.
- Network evidence:
  - Failed autosave POSTs captured with `net::ERR_INTERNET_DISCONNECTED`.
  - Subsequent autosave POSTs returned `[200] OK` after reconnect.
- Artifact paths:
  - `_bmad-output/implementation-artifacts/evidence-story-2-3-autosave-2026-02-28/scenario-b-failure-with-retry.png`
  - `_bmad-output/implementation-artifacts/evidence-story-2-3-autosave-2026-02-28/scenario-b-after-retry-saved.png`
  - `_bmad-output/implementation-artifacts/evidence-story-2-3-autosave-2026-02-28/scenario-b-network.txt`
  - `_bmad-output/implementation-artifacts/evidence-story-2-3-autosave-2026-02-28/console-errors.txt`

## Scenario C - Refresh/reopen recovery and active doc consistency

- Result: PASS
- Steps executed:
  - Reloaded same editor route.
  - Navigated back to dashboard and reopened the same project.
- Observed UI/state evidence:
  - Recovered editor content still contains failure marker:
    - `[验证B-失败阶段] 触发离线保存失败，内容应保留`
  - Autosave indicator visible after reopen: `自动保存已启用（1 秒）`.
  - Word count on reopen: `字数 10`.
  - Active document consistency in left document list:
    - `QA-A-二章` remained highlighted (`bg-accent`).
    - `第 1 章` remained non-active.
- Artifact paths:
  - `_bmad-output/implementation-artifacts/evidence-story-2-3-autosave-2026-02-28/scenario-c-reopen-recovered.png`
  - `_bmad-output/implementation-artifacts/evidence-story-2-3-autosave-2026-02-28/scenario-c-snapshot.md`

## Blockers and deviations

- No execution blockers.
- Non-blocking observation: console captured one hydration mismatch error unrelated to autosave verification (`console-errors.txt`).

# GitHub + Vercel Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish strict PR gates, secure secret handling, automatic Vercel deployments, and measurable production quality thresholds for WriteTeam.

**Architecture:** Use GitHub as the control plane for quality/security gates and Vercel as the deployment plane for preview/production. Implement in two phases: first guarantee safe deployability, then enforce quality, observability, and performance budgets. Every change is delivered in small TDD-style tasks with explicit verification commands.

**Tech Stack:** GitHub Actions, Next.js 16, Vitest, Playwright, Vercel, npm audit, gitleaks, TypeScript

---

### Task 1: Create PR Governance Templates

**Files:**
- Create: `.github/pull_request_template.md`
- Create: `.github/CODEOWNERS`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Test: `.github/pull_request_template.md`

**Step 1: Write the failing test**

```bash
rg --files .github
```

Expected: does not include the three governance files.

**Step 2: Run test to verify it fails**

Run: `rg --files .github`  
Expected: missing target files.

**Step 3: Write minimal implementation**

- Add PR template sections: summary, risk, rollback, validation checklist.
- Add CODEOWNERS with repo owner default rule.
- Add bug issue template with reproduction and expected behavior fields.

**Step 4: Run test to verify it passes**

Run: `rg --files .github`  
Expected: all three files present.

**Step 5: Commit**

```bash
git add .github/pull_request_template.md .github/CODEOWNERS .github/ISSUE_TEMPLATE/bug_report.yml
git commit -m "chore: add github governance templates"
```

### Task 2: Add CI Verify Workflow (lint/test/build)

**Files:**
- Create: `.github/workflows/ci-verify.yml`
- Test: `package.json`

**Step 1: Write the failing test**

```bash
Test-Path .github/workflows/ci-verify.yml
```

Expected: `False`.

**Step 2: Run test to verify it fails**

Run: `Test-Path .github/workflows/ci-verify.yml`  
Expected: `False`.

**Step 3: Write minimal implementation**

Create workflow with:
- trigger: `pull_request` to `main`, `push` on `main`
- Node 20 setup with npm cache
- steps: `npm ci`, `npm run lint`, `npm run test`, `npm run build`

**Step 4: Run test to verify it passes**

Run:
```bash
Test-Path .github/workflows/ci-verify.yml
Get-Content .github/workflows/ci-verify.yml
```
Expected: file exists and contains all required commands.

**Step 5: Commit**

```bash
git add .github/workflows/ci-verify.yml
git commit -m "ci: add verify workflow for lint test and build"
```

### Task 3: Add Security Workflow (audit + secret scan)

**Files:**
- Create: `.github/workflows/security.yml`
- Modify: `package.json`
- Test: `.github/workflows/security.yml`

**Step 1: Write the failing test**

```bash
Test-Path .github/workflows/security.yml
npm run | rg audit:high
```

Expected: workflow missing and script missing.

**Step 2: Run test to verify it fails**

Run commands above.  
Expected: absent workflow and no `audit:high` script.

**Step 3: Write minimal implementation**

- Add `audit:high` script to `package.json`:
  - `npm audit --audit-level=high`
- Add `security.yml` workflow:
  - run `npm ci`
  - run `npm run audit:high`
  - run gitleaks action on PR and scheduled daily scan

**Step 4: Run test to verify it passes**

Run:
```bash
npm run audit:high
Get-Content .github/workflows/security.yml
```
Expected: audit command executes; workflow includes both audit and gitleaks steps.

**Step 5: Commit**

```bash
git add package.json package-lock.json .github/workflows/security.yml
git commit -m "ci: add security workflow and high severity audit gate"
```

### Task 4: Remediate Current High Vulnerabilities

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `npm audit`

**Step 1: Write the failing test**

```bash
npm audit --audit-level=high
```

Expected: FAIL due to `hono` / `@hono/node-server` high vulnerabilities.

**Step 2: Run test to verify it fails**

Run: `npm audit --audit-level=high`  
Expected: non-zero exit code.

**Step 3: Write minimal implementation**

- Resolve dependency path with `npm ls hono @hono/node-server`.
- Upgrade the parent package or add safe `overrides` if direct upgrade is not available.
- Reinstall lockfile.

**Step 4: Run test to verify it passes**

Run:
```bash
npm audit --audit-level=high
npm run test
npm run build
```
Expected: audit passes and no regressions.

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix: remediate high severity transitive vulnerabilities"
```

### Task 5: Standardize Env Examples and Secret Policy

**Files:**
- Modify: `.env.local.example`
- Create: `.env.vercel.example`
- Create: `docs/security/secrets-policy.md`
- Create: `docs/security/dependency-policy.md`
- Test: `.env.local.example`

**Step 1: Write the failing test**

```bash
Get-Content .env.local.example
```

Expected: values not yet structured by environment and policy docs missing.

**Step 2: Run test to verify it fails**

Run: `Test-Path docs/security/secrets-policy.md`  
Expected: `False`.

**Step 3: Write minimal implementation**

- Replace sample env values with placeholders.
- Add Vercel environment mapping example for `Development/Preview/Production`.
- Document key rotation and leak response policy.
- Document vulnerability remediation SLA.

**Step 4: Run test to verify it passes**

Run:
```bash
Test-Path .env.vercel.example
Test-Path docs/security/secrets-policy.md
Test-Path docs/security/dependency-policy.md
```
Expected: all files exist and contain actionable instructions.

**Step 5: Commit**

```bash
git add .env.local.example .env.vercel.example docs/security/secrets-policy.md docs/security/dependency-policy.md
git commit -m "docs: add env templates and security policies"
```

### Task 6: Add E2E Smoke Infrastructure

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/auth.spec.ts`
- Create: `tests/e2e/editor.spec.ts`
- Create: `tests/e2e/ai-smoke.spec.ts`
- Modify: `package.json`
- Test: `tests/e2e/*.spec.ts`

**Step 1: Write the failing test**

```bash
Test-Path playwright.config.ts
npx playwright test --list
```

Expected: no config and no smoke specs.

**Step 2: Run test to verify it fails**

Run: `npx playwright test --list`  
Expected: no tests discovered or command fails due to missing setup.

**Step 3: Write minimal implementation**

- Add Playwright config with base URL from env and trace on retry.
- Add smoke tests for login, editor save path, and one AI flow.
- Add scripts:
  - `test:e2e`
  - `test:e2e:smoke`

**Step 4: Run test to verify it passes**

Run:
```bash
npx playwright test --list
npm run test:e2e:smoke
```
Expected: smoke cases discovered; smoke run passes in configured environment.

**Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e package.json package-lock.json
git commit -m "test: add playwright smoke e2e suite"
```

### Task 7: Add E2E Smoke Workflow for PR

**Files:**
- Create: `.github/workflows/e2e-smoke.yml`
- Test: `.github/workflows/e2e-smoke.yml`

**Step 1: Write the failing test**

```bash
Test-Path .github/workflows/e2e-smoke.yml
```

Expected: `False`.

**Step 2: Run test to verify it fails**

Run command above.  
Expected: workflow missing.

**Step 3: Write minimal implementation**

- Add workflow to run smoke E2E on PR.
- Use service URL from preview deployment (or local app start fallback).

**Step 4: Run test to verify it passes**

Run: `Get-Content .github/workflows/e2e-smoke.yml`  
Expected: workflow references `npm run test:e2e:smoke` and PR trigger.

**Step 5: Commit**

```bash
git add .github/workflows/e2e-smoke.yml
git commit -m "ci: add e2e smoke workflow"
```

### Task 8: Add Observability Utilities and Error Envelope

**Files:**
- Create: `src/lib/observability/logger.ts`
- Create: `src/lib/observability/request-id.ts`
- Modify: `src/app/api/ai/write/route.ts`
- Modify: `src/lib/ai/shared-pipeline.ts`
- Test: `src/app/api/ai/write/route.test.ts` (or closest contract test)

**Step 1: Write the failing test**

Add/adjust route test to expect `{ error, code, requestId }` on failure responses.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/ai/write/route.test.ts`  
Expected: assertion failure on response shape.

**Step 3: Write minimal implementation**

- Add request ID helper and include in error responses.
- Add structured logger with redaction guard.
- Ensure no secret values are logged.

**Step 4: Run test to verify it passes**

Run:
```bash
npx vitest run src/app/api/ai/write/route.test.ts
npm run test
```
Expected: route test and curated suite pass.

**Step 5: Commit**

```bash
git add src/lib/observability/logger.ts src/lib/observability/request-id.ts src/app/api/ai/write/route.ts src/lib/ai/shared-pipeline.ts
git commit -m "feat: add request id and standardized api error envelope"
```

### Task 9: Performance, SEO, and Accessibility Baseline

**Files:**
- Modify: `src/components/ai/visualize-panel.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/app/robots.ts`
- Create: `src/app/sitemap.ts`
- Create: `docs/perf/performance-budget.md`
- Test: `npm run lint`, `npm run build`

**Step 1: Write the failing test**

```bash
npm run lint
```

Expected: warning on `@next/next/no-img-element` in visualize panel.

**Step 2: Run test to verify it fails**

Run: `npm run lint`  
Expected: warning present.

**Step 3: Write minimal implementation**

- Replace `<img>` with `next/image` equivalents.
- Add robots and sitemap routes.
- Complete metadata fields in root layout.
- Add documented performance budgets and thresholds.

**Step 4: Run test to verify it passes**

Run:
```bash
npm run lint
npm run build
```
Expected: warning resolved and production build passes.

**Step 5: Commit**

```bash
git add src/components/ai/visualize-panel.tsx src/app/layout.tsx src/app/robots.ts src/app/sitemap.ts docs/perf/performance-budget.md
git commit -m "feat: improve seo metadata and lcp image handling"
```

### Task 10: Operations Docs and Final Verification

**Files:**
- Create: `docs/ops/slo-sli.md`
- Create: `docs/ops/runbook.md`
- Test: end-to-end verification commands

**Step 1: Write the failing test**

```bash
Test-Path docs/ops/slo-sli.md
Test-Path docs/ops/runbook.md
```

Expected: both `False`.

**Step 2: Run test to verify it fails**

Run commands above.  
Expected: docs missing.

**Step 3: Write minimal implementation**

- Define SLI/SLO, thresholds, alert channels, and escalation matrix.
- Add deployment rollback runbook for Vercel + GitHub.

**Step 4: Run test to verify it passes**

Run:
```bash
npm run lint
npm run test
npm run build
```
Expected: all checks pass.

**Step 5: Commit**

```bash
git add docs/ops/slo-sli.md docs/ops/runbook.md
git commit -m "docs: add reliability slos and incident runbook"
```

## Branch / Platform Actions (Manual but Required)

1. Configure GitHub branch protection on `main`:
- Require PR, approvals, and required checks.
- Disallow direct pushes.

2. Configure Vercel project:
- Production branch = `main`
- Preview deployments enabled for PRs
- Env vars set for Production/Preview/Development

3. Validate deployment:
- Open PR from `feature/*`
- Ensure all required checks pass
- Merge PR
- Confirm Vercel production deploy succeeds and domain returns 200

## Final Verification Checklist

Run in repository root:

```bash
npm run lint
npm run test
npm run build
npm run audit:high
```

Expected:
- lint: no errors (target no warnings)
- test: all pass
- build: success
- audit: no high/critical vulnerabilities


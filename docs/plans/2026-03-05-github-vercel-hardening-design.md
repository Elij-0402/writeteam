# GitHub + Vercel Hardening Design

**Date:** 2026-03-05  
**Project:** WriteTeam (`D:\writeteam`)  
**Mode:** A2 (strict governance, phased hardening)

## 1. Goal

Build a reliable delivery pipeline from local feature branches to GitHub PR merge into `main`, and automatic deployment to Vercel production with measurable quality, performance, and security gates.

## 2. Baseline Diagnosis

### 2.1 Confirmed healthy
- Git remote is configured to GitHub (`origin` points to `Elij-0402/writeteam`).
- Working tree is clean on `main`.
- `npm run test` passes (119 tests).
- `npm run build` passes on Next.js 16.1.6.
- `npm run lint` has no errors (2 warnings on `<img>` usage).

### 2.2 Confirmed gaps
- No `.github/workflows` exists: no CI gates for PR and `main`.
- No E2E test baseline (unit/integration only).
- No explicit observability stack for production error and uptime thresholds.
- Security scan reports `high` vulnerabilities in transitive dependencies (`hono`, `@hono/node-server`).
- Secrets were shared in plain text and must be treated as exposed.

## 3. Acceptance Criteria

1. Feature branch workflow supports PR review and merge to `main` only through protected checks.  
2. Vercel auto-deploys on `main` merge, production domain is active and reachable.  
3. Post-deploy metrics meet thresholds (LCP/TTFB/error-rate/availability).  
4. Security and compliance controls are enforced (secret management, vulnerability remediation, privacy-safe logs).

## 4. Target Operating Model

### 4.1 Branch and review governance
- Branch naming: `feature/*`, `fix/*`, `chore/*`.
- `main` protected: no direct push.
- Mandatory PR review (>=1 approval).
- Mandatory status checks.
- Branch must be up-to-date before merge.

### 4.2 CI/CD policy
- CI on PR and `main` push:
  - install (`npm ci`)
  - lint (`npm run lint`)
  - tests (`npm run test`)
  - build (`npm run build`)
- Security workflow:
  - `npm audit --audit-level=high`
  - secret scan (gitleaks)
- Deployment:
  - Vercel Git integration
  - Preview deploy for PR
  - Production deploy on `main`

### 4.3 Security and compliance policy
- Rotate all previously shared credentials immediately.
- Store credentials only in GitHub Actions secrets and Vercel environment variables.
- No secret values in repository, PR comments, issue comments, or logs.
- Enforce vulnerability SLA (`high/critical` must be zero before merge to `main`).

## 5. Performance / Reliability SLO

- LCP P75 < 2.5s
- TTFB P75 < 800ms
- INP P75 < 200ms
- CLS P75 < 0.1
- Frontend session error rate < 1%
- API 5xx rate < 0.5%
- Availability >= 99.9% (7-day rolling)

## 6. Phased Plan (A2)

## Phase 1 (1-2 days): Deployment path and minimum production safety

### Outcomes
- PR gate is mandatory.
- Auto-deploy to Vercel production is stable.
- Domain active and validated.
- High vulnerabilities remediated.
- Secret handling moved to platform-managed config.

### Actions
1. Enforce branch protection and required checks on GitHub.
2. Add CI verify workflow for lint/test/build.
3. Add security workflow for audit + secret scan.
4. Configure Vercel integration with `main` as production branch.
5. Set production/preview/development environment variables in Vercel.
6. Remediate `high` dependency vulnerabilities.
7. Validate one end-to-end PR merge and deployment.

### Exit criteria
- Required checks block bad PRs.
- Merged PR deploys automatically to Vercel.
- Production URL returns HTTP 200 and SSL is active.
- `npm audit --audit-level=high` passes.

## Phase 2 (1-2 days): Quality, observability, and performance hardening

### Outcomes
- E2E smoke gates added.
- Coverage thresholds formalized.
- Monitoring dashboards and alerts operational.
- SEO/a11y/performance checks become part of CI policy.

### Actions
1. Add Playwright smoke tests for critical user flows.
2. Add Vitest coverage thresholds.
3. Add structured logging with request IDs and redaction policy.
4. Add SLO docs and incident runbook.
5. Replace `<img>` with `next/image` in performance-critical components.
6. Add `robots.ts` and `sitemap.ts`; complete metadata.

### Exit criteria
- PR smoke E2E gate is running and stable.
- Production metrics available and threshold breaches visible.
- SEO/a11y minimum checks pass.
- Error and availability alerts are actionable.

## 7. File-Level Implementation Blueprint

### Repository governance
- Create `.github/pull_request_template.md`
- Create `.github/CODEOWNERS`
- Create `.github/ISSUE_TEMPLATE/bug_report.yml`

### Workflows
- Create `.github/workflows/ci-verify.yml`
- Create `.github/workflows/security.yml`
- Create `.github/workflows/e2e-smoke.yml` (Phase 2)

### Test and quality
- Modify `vitest.config.ts` (coverage thresholds)
- Create `playwright.config.ts`
- Create `tests/e2e/auth.spec.ts`
- Create `tests/e2e/editor.spec.ts`
- Create `tests/e2e/ai-smoke.spec.ts`
- Modify `package.json` scripts (`test:e2e`, `test:e2e:smoke`, `test:coverage`, `audit:high`)

### Security and config docs
- Modify `.env.local.example` (placeholders only)
- Create `.env.vercel.example`
- Create `docs/security/secrets-policy.md`
- Create `docs/security/dependency-policy.md`

### Observability and reliability
- Create `src/lib/observability/logger.ts`
- Create `src/lib/observability/request-id.ts`
- Modify key route handlers to emit consistent `{ error, code, requestId }`
- Create `docs/ops/slo-sli.md`
- Create `docs/ops/runbook.md`

### Performance / SEO / a11y
- Modify `src/components/ai/visualize-panel.tsx` (use `next/image`)
- Create `src/app/robots.ts`
- Create `src/app/sitemap.ts`
- Modify `src/app/layout.tsx` metadata completeness
- Create `docs/perf/performance-budget.md`

## 8. Milestones

- M1 (0.5 day): governance + CI/security workflows + immediate secret response
- M2 (0.5 day): test hardening (coverage + smoke E2E)
- M3 (0.5 day): observability + reliability docs + request tracing
- M4 (0.5 day): performance/SEO/a11y hardening + final production validation

## 9. Risks and Controls

- Risk: CI false positives block team throughput.
  - Control: Start with pragmatic thresholds and tighten gradually.
- Risk: Dependency forced upgrades introduce regressions.
  - Control: require targeted tests and canary PR for dependency changes.
- Risk: Secret leakage recurrence in collaboration channels.
  - Control: codified policy + automated secret scanning + key rotation runbook.

## 10. Decision

Adopt A2 phased hardening with strict governance (`main` protected, mandatory checks, mandatory reviews). Execute Phase 1 first to guarantee deploy safety, then Phase 2 to enforce production quality and observability.

# Dependency Security Policy

## Objective
Keep production dependencies free of high/critical vulnerabilities before merge to `main`.

## Required Gates
- CI command: `npm run audit:high`
- Secret scan: gitleaks in `security.yml`

## Severity SLA
- Critical: fix within 4 hours
- High: fix within 24 hours
- Moderate: fix in next planned sprint
- Low: monitor and batch update monthly

## Remediation Order
1. Upgrade direct dependency to patched version.
2. Upgrade parent dependency introducing vulnerable transitive package.
3. Use `overrides` only when no safe upstream release is immediately available.

## Verification
After dependency changes, run:
1. `npm run audit:high`
2. `npm run test`
3. `npm run build`

## Release Rule
If audit reports high/critical vulnerabilities, release is blocked until remediation and verification pass.

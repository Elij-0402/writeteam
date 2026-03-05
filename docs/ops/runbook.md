# Incident Runbook

## Severity
- Sev1: Full outage or auth unavailable
- Sev2: Major feature degraded (AI route or editor write path)
- Sev3: Partial degradation with workaround

## Immediate Response
1. Acknowledge incident and assign owner.
2. Capture timeline with UTC+8 timestamp.
3. Validate blast radius (routes, users, regions).
4. Roll back latest deployment if issue is release-induced.

## Rollback Procedure
1. Open Vercel project deployments.
2. Promote last known healthy deployment.
3. Confirm home/login/editor critical path is healthy.
4. Lock merges until root cause fix is merged.

## Postmortem
- Root cause
- User impact
- Detection gap
- Action items with owners and due dates

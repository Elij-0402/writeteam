# Secrets Policy

## Scope
This policy applies to local development, CI (GitHub Actions), and deployment environments (Vercel).

## Rules
1. Never commit or paste secrets into source code, markdown, PR comments, issue comments, or chat logs.
2. Store runtime secrets only in platform secret managers:
- GitHub Actions Secrets
- Vercel Environment Variables
3. Keep `.env*` files ignored by git and use example templates with placeholders only.
4. Use least privilege API keys and separate keys per environment.

## Rotation
- Routine rotation interval: every 90 days.
- Mandatory immediate rotation when a secret is shared in plain text outside secret managers.

## Leak Response Runbook
1. Revoke exposed key immediately.
2. Create and distribute replacement key through secret managers only.
3. Verify no hardcoded secret remains:
- `rg -n "(sk-|AIza|AKIA|-----BEGIN|SUPABASE|API_KEY)" .`
4. Review logs for unauthorized use and alert owner.
5. Document incident timeline and remediation actions.

## Logging Redaction
Never log:
- API keys/tokens/passwords
- full Authorization headers
- full request bodies containing user private text

Log only metadata (request ID, route, status, latency).

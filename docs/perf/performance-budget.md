# Performance Budget

## Core Web Vitals Targets (P75)
- LCP < 2.5s
- INP < 200ms
- CLS < 0.1

## Backend Targets
- TTFB < 800ms
- API 5xx rate < 0.5%

## Asset Budgets
- Initial JS payload <= 250KB (gzip)
- Critical CSS <= 60KB (gzip)
- Hero image <= 150KB where possible

## Release Gate
If any target degrades by >10% from 7-day baseline, release owner must:
1. open a perf incident issue,
2. document root cause,
3. provide rollback or mitigation plan.

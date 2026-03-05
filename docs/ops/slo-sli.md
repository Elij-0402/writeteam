# SLO and SLI

## SLO Targets
- Availability: >= 99.9% (7-day rolling)
- Frontend session error rate: < 1%
- API error rate (5xx): < 0.5%
- LCP P75: < 2.5s
- TTFB P75: < 800ms

## SLI Sources
- Vercel Analytics / Speed Insights for web performance
- Runtime logs for API status and latency
- Uptime probe for production domain reachability

## Alerting
- P1: availability drop below 99.5% for 10 minutes
- P2: API 5xx above 1% for 15 minutes
- P3: LCP/TTFB out of budget for 24 hours

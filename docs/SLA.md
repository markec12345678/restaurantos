# Service Level Agreement (SLA)

**RestaurantOS — Production Service Level Agreement**
Version 1.0 — Effective 2026-09-06

---

## 1. Service Availability

### 1.1 Uptime Guarantee

RestaurantOS guarantees **99.5% monthly uptime** for the Production
environment, excluding scheduled maintenance.

| Metric | Target | Measurement |
|--------|--------|-------------|
| Monthly Uptime | ≥ 99.5% | (Total minutes − Downtime) / Total minutes |
| Max Downtime/Year | 43.8 hours | Based on 99.5% over 8,760 hours |
| Max Downtime/Month | 3.65 hours | Based on 99.5% over 730 hours |

### 1.2 Definition of Downtime

"Downtime" means the Production environment is unavailable for HTTP
requests (non-200 responses or timeouts > 30 seconds) for at least
5 consecutive minutes.

Downtime does NOT include:
- Scheduled maintenance (announced ≥ 72 hours in advance)
- Force majeure events (natural disasters, ISP outages, cloud provider
  region failures)
- Issues caused by Customer's configuration, network, or third-party
  integrations (Stripe, FURS, Glovo, Wolt)
- Rate-limited requests (429 responses)
- Customer-initiated downtime (e.g., database migrations)

---

## 2. Incident Response Times

### 2.1 Severity Levels

| Severity | Definition | Response Time | Resolution Target |
|----------|------------|---------------|-------------------|
| **P1 — Critical** | Production down; data loss; payment processing failure | 1 hour | 4 hours |
| **P2 — High** | Major feature broken; significant performance degradation | 4 hours | 24 hours |
| **P3 — Normal** | Minor feature broken; workaround available | 24 hours | 5 business days |
| **P4 — Low** | Cosmetic issues; feature requests | 48 hours | Next release |

### 2.2 Response Time Definitions

- **Response Time**: Time from ticket creation to first human acknowledgment
- **Resolution Time**: Time from ticket creation to fix deployed to Production
- **Business Hours**: Monday–Friday, 08:00–20:00 CET (Slovenia)

P1/P2 incidents are monitored 24/7 via Vercel + Sentry alerts.
P3/P4 are handled during business hours.

---

## 3. Service Credits

### 3.1 Credit Calculation

If monthly uptime falls below 99.5%, Customer is eligible for service
credits calculated as follows:

| Monthly Uptime | Service Credit |
|----------------|----------------|
| 99.0% – 99.49% | 10% of monthly fee |
| 95.0% – 98.99% | 25% of monthly fee |
| Below 95.0% | 50% of monthly fee |

### 3.2 Credit Claim Process

1. Customer must submit a claim within 30 days of the incident
2. Include incident timestamps and affected endpoints
3. Credits applied to next invoice (non-refundable, non-transferable)
4. Maximum aggregate credits: 50% of monthly fee

---

## 4. Escalation Matrix

### 4.1 Escalation Path

```
Level 1: Support Engineer (on-call 24/7 for P1)
    ↓ (if no response in 30 min for P1)
Level 2: Senior Engineer
    ↓ (if no resolution in 2 hours for P1)
Level 3: CTO / Engineering Lead
    ↓ (if customer requests)
Level 4: CEO
```

### 4.2 Contact Methods

| Priority | Method | Contact |
|----------|--------|---------|
| P1 — Critical | Phone + SMS + Email | +386 X XXX XX XX (24/7) |
| P2 — High | Email + Slack | urgent@restaurantos.app |
| P3 — Normal | Email | support@restaurantos.app |
| P4 — Low | Email | support@restaurantos.app |

### 4.3 Communication Cadence

- **P1**: Status update every 30 minutes until resolved
- **P2**: Status update every 2 hours during business hours
- **P3/P4**: Status update at ticket creation and resolution

---

## 5. Scheduled Maintenance

### 5.1 Maintenance Window

- **Primary**: Sunday 02:00–06:00 CET (low-traffic window)
- **Secondary**: Wednesday 03:00–05:00 CET (emergency only)

### 5.2 Notification Requirements

- **Standard maintenance**: 72 hours advance notice via email
- **Emergency maintenance**: 1 hour advance notice (P1/P2 fixes)
- **Zero-downtime deployments**: No notice required (blue-green)

### 5.3 Maintenance Duration

- Standard: ≤ 2 hours
- Emergency: ≤ 1 hour
- Database migrations: ≤ 30 minutes (online migration preferred)

---

## 6. Support Channels

### 6.1 Support Tiers

| Tier | Response | Channels | Hours |
|------|----------|----------|-------|
| **Standard** (included) | P3/P4 only | Email | Business hours |
| **Priority** (+€500/mo) | P2/P3/P4 | Email + Slack | Business hours |
| **Enterprise** (custom) | P1/P2/P3/P4 | Email + Slack + Phone | 24/7 for P1 |

### 6.2 Support Channels

- **Email**: support@restaurantos.app
- **Slack**: #restaurantos-support (Priority+ tier)
- **Phone**: +386 X XXX XX XX (Enterprise tier, P1 only)
- **Status Page**: https://status.restaurantos.app
- **Documentation**: https://docs.restaurantos.app

---

## 7. Performance Targets

### 7.1 API Response Times

| Endpoint Type | P50 Target | P95 Target | P99 Target |
|---------------|------------|------------|------------|
| Simple GET (list) | 100ms | 300ms | 500ms |
| Complex GET (with includes) | 200ms | 500ms | 1s |
| POST/PUT (write) | 150ms | 400ms | 800ms |
| Payment processing | 300ms | 800ms | 2s |
| Report generation | 1s | 3s | 5s |

### 7.2 Page Load Times

| Page | P50 Target | P95 Target |
|------|------------|------------|
| POS (waiter) | 1s | 2s |
| KDS (kitchen) | 500ms | 1.5s |
| Dashboard | 1.5s | 3s |
| Reports | 2s | 4s |

---

## 8. Data Backup & Recovery

### 8.1 Backup Schedule

- **Database**: Continuous WAL streaming + daily snapshots (Neon PostgreSQL)
- **Retention**: 30 days point-in-time recovery
- **Geo-replication**: Yes (Neon multi-region)

### 8.2 Recovery Objectives

| Metric | Target |
|--------|--------|
| RPO (Recovery Point Objective) | 5 minutes |
| RTO (Recovery Time Objective) | 1 hour |
| RTO (Critical data loss) | 4 hours |

---

## 9. Security Incident Response

### 9.1 Security Incident Definition

- Data breach (unauthorized access to customer data)
- Authentication bypass
- SQL injection or similar code-level vulnerabilities
- Compromised API keys or session tokens

### 9.2 Response Process

1. **Detection** (≤ 1 hour): Sentry + Vercel alerts + manual reports
2. **Triage** (≤ 1 hour): Severity assignment + initial containment
3. **Containment** (≤ 4 hours): Stop the bleeding
4. **Eradication** (≤ 24 hours): Remove root cause
5. **Recovery** (≤ 48 hours): Restore normal operations
6. **Post-mortem** (≤ 7 days): Public disclosure if customer data was affected

### 9.3 Customer Notification

- P1 security incidents: Notify affected customers within 72 hours
- GDPR compliance: Notify supervisory authority within 72 hours
- Public disclosure: After containment + customer notification

---

## 10. Limitations

### 10.1 Exclusions

This SLA does not cover:
- Issues caused by Customer's misuse or unauthorized modification
- Issues caused by third-party services (Stripe, FURS, Glovo, Wolt,
  Vercel, Neon, Sentry) beyond RestaurantOS control
- Force majeure events
- Issues during Customer's free trial period
- Issues in non-Production environments (staging, dev, preview)

### 10.2 Maximum Liability

RestaurantOS's maximum aggregate liability under this SLA is limited
to the fees paid by Customer in the 3 months preceding the incident.

---

## 11. Agreement Terms

### 11.1 Effective Date

This SLA is effective as of 2026-09-06 and remains in effect for the
duration of the Customer's paid subscription.

### 11.2 Changes to SLA

RestaurantOS may modify this SLA with 30 days advance notice. Material
changes (reduced uptime, longer response times) require Customer consent.

### 11.3 Governing Law

This SLA is governed by the laws of the Republic of Slovenia.
Disputes are resolved in Ljubljana courts.

---

*RestaurantOS SLA v1.0 — Questions? Contact legal@restaurantos.app*

# Phase 11 — Live Platform Go-Live Readiness Guide

**Document:** Production Configuration & Monitoring
**Version:** 1.0
**Status:** Final Production-Ready
**Date:** 2026-05-25
**rule_applied_id:** GOLIVE_READINESS_v1.0

---

## Table of Contents

1. [Production Configuration](#production-configuration)
2. [Monitoring & Alerting](#monitoring--alerting)
3. [Rollback Procedures](#rollback-procedures)
4. [Graceful Degradation](#graceful-degradation)
5. [Environment Validation](#environment-validation)
6. [Deployment Dry-Run Checklist](#deployment-dry-run-checklist)
7. [Incident Response](#incident-response)

---

## 1. Production Configuration

### 1.1 Required Environment Variables

All environment variables must be injected from AWS Secrets Manager or ECS task definitions. **Never hardcode secrets in code.**

#### CyranoEngines Webhook Security

```bash
CYRANOENGINES_WEBHOOK_SECRET=<generate-256-bit-secret>
```

Used for HMAC-SHA256 signing of webhook callbacks. Platforms verify webhooks came from CyranoEngines.

#### Outbound Webhook Partner Endpoints

```bash
OUTBOUND_WEBHOOK_URL_REDROOM_REWARDS=https://api.redroomrewards.zone/webhooks/cnz
OUTBOUND_WEBHOOK_URL_MARKETPLACE_BUILD=https://api.marketplace.chatnow.zone/webhooks/cnz
OUTBOUND_WEBHOOK_SIGNING_SECRET=<generate-256-bit-secret>
```

Used by OutboundWebhookService for partner integrations.

#### Database & Redis (Canada Region Only)

```bash
DATABASE_URL=postgresql://user:pass@db.ca-central-1.rds.amazonaws.com:5432/chatnowzone
REDIS_URL=redis://redis.ca-central-1.cache.amazonaws.com:6379
```

**CRITICAL:** Must be ca-central-1 (Canada - Montreal) per INFRA_v1.0 PIPEDA compliance.

#### GateGuard Sentinel Configuration

```bash
GATEGUARD_COOLDOWN_THRESHOLD=40
GATEGUARD_HARD_DECLINE_THRESHOLD=70
GATEGUARD_HUMAN_ESCALATE_THRESHOLD=90
```

Welfare and fraud score thresholds (0-100 scale).

#### NATS Messaging

```bash
NATS_URL=nats://nats.ca-central-1.internal:4222
NATS_CLUSTER_ID=cnz-production
```

Event fabric for all real-time messaging.

### 1.2 Governance Configuration (CEO-Locked)

Located in `/services/core-api/src/governance/governance.config.ts`

**Do not modify without CEO authorization.**

Key locked constants:

- FFS Payout Rates: 7.5¢ (COLD) to 9.0¢ (INFERNO)
- DFSP Integrity Hold: CAD $100-$500
- Purchase Window: 11:00-23:00 local time
- Webhook Replay Window: 5 minutes
- OTP TTL: 15 minutes, 5 attempts max

---

## 2. Monitoring & Alerting

### 2.1 OmniSync™ Telemetry Dashboard

**Service:** `OmniSyncTelemetryService`
**Endpoint:** `/creator/control/omnisync/snapshot`
**Update Frequency:** Real-time (60-minute rolling window)

**Monitored Metrics:**

1. **GateGuard Sentinel:**
   - Decision distribution (APPROVE/COOLDOWN/HARD_DECLINE/HUMAN_ESCALATE)
   - Average fraud score (0-100)
   - Average welfare score (0-100)
   - Welfare distress signals count

2. **Flicker n'Flame Scoring (FFS):**
   - Tier distribution (COLD/WARM/HOT/INFERNO)
   - Average score
   - Peak score
   - Active sessions count

3. **Payout Engine:**
   - Rate tier usage (7.5¢ through 9.0¢)
   - Total CZT paid out
   - Average payout rate

4. **Compliance:**
   - Audit chain integrity status
   - Active legal holds count
   - RedBook safety flags (last hour)
   - Geo-fence violations (last hour)

5. **Risk Engine:**
   - Risk distribution (GREEN/AMBER/RED)
   - VPN detection count
   - Device churn count

### 2.2 Critical Alerts

**Set up PagerDuty/CloudWatch alarms for:**

| Alert                          | Condition                          | Severity | Response Time |
| ------------------------------ | ---------------------------------- | -------- | ------------- |
| Audit Chain Integrity Breach   | `audit_chain_intact = false`       | P0       | Immediate     |
| Excessive Human Escalations    | `HUMAN_ESCALATE > 10/hour`         | P1       | 15 minutes    |
| Platform Risk Elevated         | `avg_risk_score > 60`              | P1       | 30 minutes    |
| GateGuard Bypass Attempt       | `gateguard.bypass.attempted` event | P0       | Immediate     |
| Welfare Cooldown Bypass        | `welfare.cooldown.bypassed` event  | P0       | Immediate     |
| Legal Hold Bypass              | `legal.hold.bypassed` event        | P0       | Immediate     |
| CyranoEngines Webhook Failures | `failed_callbacks > 5`             | P2       | 1 hour        |

### 2.3 Dual Integrity Architecture (DIA) Monitoring

**Service:** `DualIntegrityEnforcementService`
**Endpoint:** `/compliance/dual-integrity/snapshot`

**Monitored Compliance Flags:**

- `gateguard_enforced`: Pre-transaction risk checks honored
- `welfare_enforced`: Cooldown periods respected
- `audit_chain_intact`: No hash chain breaks
- `legal_holds_respected`: Held entities blocked
- `fiz_correlations_present`: All ledger entries have correlation_id

**System Status:**

- `COMPLIANT`: All flags green
- `DEGRADED`: Legal hold or FIZ correlation issues
- `CRITICAL`: GateGuard, Welfare, or Audit Chain failures

---

## 3. Rollback Procedures

### 3.1 Emergency Rollback (< 5 minutes)

**Scenario:** Critical production issue detected after deployment.

**Steps:**

1. **Immediate Traffic Shift (< 2 min):**

   ```bash
   # AWS ECS: Update service to previous task definition
   aws ecs update-service \
     --cluster cnz-production \
     --service creator-control \
     --task-definition creator-control:PREVIOUS_VERSION \
     --region ca-central-1

   # Or use AWS Load Balancer target group switch
   aws elbv2 modify-rule \
     --rule-arn <RULE_ARN> \
     --actions TargetGroupArn=<PREVIOUS_TG_ARN>
   ```

2. **Disable New Features (< 1 min):**

   ```typescript
   // Via SyntheticFeatureToggleService admin API
   POST /admin/toggles/batch-disable
   {
     "features": ["SAFE_SYNTHETIC_TWIN", "CYRANO_WHISPER", "OMNISYNC_TELEMETRY"],
     "reason": "Emergency rollback - production incident",
     "updated_by": "ops-oncall"
   }
   ```

3. **Notify Stakeholders (< 2 min):**
   - Post to #incidents Slack channel
   - Notify CEO and CTO
   - Update status page

### 3.2 Database Rollback

**CRITICAL:** Database rollbacks are high-risk due to append-only ledger.

**Only for schema changes, never for data:**

```bash
# Revert Prisma migration
yarn prisma migrate resolve --rolled-back <MIGRATION_NAME>
yarn prisma migrate deploy

# Verify schema
yarn prisma db pull
yarn prisma generate
```

**For data issues:**

- **Never DELETE** from ledger, balance, or audit tables
- Create compensating entries with reason_code: `ROLLBACK_COMPENSATION`
- Document in incident report

### 3.3 Feature Flag Rollback

Use `SyntheticFeatureToggleService` to disable features without redeployment:

```typescript
// Disable a feature globally
setToggle({
  feature: 'SAFE_SYNTHETIC_TWIN',
  state: 'DISABLED',
  scope: 'GLOBAL',
  updated_by: 'ops-oncall',
  reason: 'Rollback due to production issue #1234',
  rule_applied_id: 'SYNTHETIC_TOGGLES_v1.0',
});

// Gradual rollback (reduce from 100% to 10%)
setToggle({
  feature: 'CYRANO_WHISPER',
  state: 'ROLLOUT',
  scope: 'GLOBAL',
  rollout_percentage: 10,
  updated_by: 'ops-oncall',
  reason: 'Gradual rollback to investigate latency spike',
  rule_applied_id: 'SYNTHETIC_TOGGLES_v1.0',
});
```

---

## 4. Graceful Degradation

All webhook flows implement graceful degradation to prevent cascading failures.

### 4.1 CyranoEngines Webhook Failures

**Automatic Retry Logic:**

- Max retries: 5
- Backoff: Exponential with jitter (1s, 2s, 4s, 8s, 16s, max 60s)
- Timeout: 10 seconds per attempt

**After Max Retries:**

- Failed callback stored in `failedCallbacks` Map
- Alert triggered: `cyranoengines.webhook.failed`
- Manual retry available via `/admin/webhooks/retry/:job_id`

**Platform Behavior:**

- Creator UI shows "Generation in Progress" indefinitely
- After 5 minutes, display "Generation taking longer than expected" message
- Do NOT block creator from continuing broadcast

### 4.2 GateGuard Sentinel Unavailable

**Fallback Strategy:**

- If GateGuard doesn't respond within 2 seconds, default to `APPROVE` with elevated logging
- Emit `gateguard.timeout` event for manual review queue
- DO NOT block legitimate transactions due to service downtime

**Recovery:**

- Once GateGuard recovers, evaluate queued transactions asynchronously
- Retroactive COOLDOWN or HARD_DECLINE decisions logged but not enforced

### 4.3 NATS Messaging Unavailable

**Critical Subsystems:**

- Creator Control telemetry: Buffer events in-memory (max 1000 events)
- FFS scoring: Continue calculations, emit to NATS on reconnect
- Audit chain: **HALT ALL OPERATIONS** — audit trail is non-negotiable

**Non-Critical Subsystems:**

- OmniSync telemetry: Accept data loss, display "Metrics Unavailable" in dashboard
- Feature toggle change events: Log locally, sync on reconnect

### 4.4 Database Connection Loss

**Read Operations:**

- Return cached data with `stale_data` flag
- Display banner: "Some data may be out of date"

**Write Operations:**

- **Financial (ledger, balance, payout):** HALT immediately, return 503
- **Non-financial (chat, metadata):** Queue in Redis, sync on reconnect

---

## 5. Environment Validation

### 5.1 Pre-Deployment Validation Script

Run before every production deployment:

```bash
#!/bin/bash
# validate-production-env.sh

set -e

echo "Validating ChatNowZone Production Environment..."

# 1. Check required secrets
required_secrets=(
  "CYRANOENGINES_WEBHOOK_SECRET"
  "OUTBOUND_WEBHOOK_SIGNING_SECRET"
  "DATABASE_URL"
  "REDIS_URL"
  "NATS_URL"
)

for secret in "${required_secrets[@]}"; do
  if [ -z "${!secret}" ]; then
    echo "ERROR: Missing required secret: $secret"
    exit 1
  fi
done

# 2. Verify Canada region
if ! echo "$DATABASE_URL" | grep -q "ca-central-1"; then
  echo "ERROR: DATABASE_URL must be in ca-central-1 (Canada) region"
  exit 1
fi

# 3. Check database connectivity
echo "Testing database connection..."
yarn prisma db pull --force || {
  echo "ERROR: Cannot connect to database"
  exit 1
}

# 4. Verify Redis connectivity
echo "Testing Redis connection..."
redis-cli -u "$REDIS_URL" PING || {
  echo "ERROR: Cannot connect to Redis"
  exit 1
}

# 5. Verify NATS connectivity
echo "Testing NATS connection..."
nats-sub -s "$NATS_URL" "test.validation" --count=1 --timeout=5s || {
  echo "ERROR: Cannot connect to NATS"
  exit 1
}

# 6. Run TypeScript type check
echo "Running TypeScript type check..."
yarn typecheck || {
  echo "ERROR: TypeScript type check failed"
  exit 1
}

# 7. Run Prisma generate
echo "Generating Prisma Client..."
yarn prisma generate || {
  echo "ERROR: Prisma generate failed"
  exit 1
}

# 8. Verify governance config locked
echo "Verifying governance configuration..."
if ! grep -q "CEO-AUTHORIZED — LOCKED" services/core-api/src/governance/governance.config.ts; then
  echo "WARNING: Governance config may not be properly locked"
fi

echo "✅ Environment validation complete. Safe to deploy."
```

### 5.2 Post-Deployment Smoke Tests

```bash
#!/bin/bash
# smoke-test-production.sh

set -e

BASE_URL="https://api.chatnow.zone"

echo "Running post-deployment smoke tests..."

# 1. Health check
curl -f "$BASE_URL/health" || {
  echo "ERROR: Health check failed"
  exit 1
}

# 2. OmniSync telemetry snapshot
curl -f "$BASE_URL/creator/control/omnisync/snapshot" -H "Authorization: Bearer $ADMIN_TOKEN" || {
  echo "ERROR: OmniSync telemetry endpoint failed"
  exit 1
}

# 3. Dual Integrity compliance snapshot
curl -f "$BASE_URL/compliance/dual-integrity/snapshot" -H "Authorization: Bearer $ADMIN_TOKEN" || {
  echo "ERROR: Dual Integrity endpoint failed"
  exit 1
}

# 4. Feature toggle status
curl -f "$BASE_URL/admin/toggles" -H "Authorization: Bearer $ADMIN_TOKEN" || {
  echo "ERROR: Feature toggles endpoint failed"
  exit 1
}

# 5. Verify NATS topics
nats-sub -s "$NATS_URL" "omnisync.telemetry.snapshot" --count=1 --timeout=30s || {
  echo "WARNING: No OmniSync telemetry events in 30s"
}

echo "✅ Smoke tests passed."
```

---

## 6. Deployment Dry-Run Checklist

Before merging PR and deploying to production:

### Pre-Deployment

- [ ] All Phase 11 items completed (1-5)
- [ ] TypeScript type check passes (`yarn typecheck`)
- [ ] Prisma migrations applied (`yarn prisma migrate deploy`)
- [ ] Environment variables validated (run `validate-production-env.sh`)
- [ ] Secrets loaded from AWS Secrets Manager
- [ ] Feature toggles configured (default states set)
- [ ] Database backup completed (< 1 hour old)
- [ ] Redis cache flushed (if schema changes)

### Deployment

- [ ] Deploy to staging first, run full E2E tests
- [ ] Blue-green deployment with 0% traffic to new version
- [ ] Run smoke tests against new version
- [ ] Gradually shift traffic: 5% → 25% → 50% → 100%
- [ ] Monitor OmniSync telemetry dashboard for anomalies
- [ ] Watch Dual Integrity compliance status (must stay COMPLIANT)
- [ ] No spike in GateGuard HUMAN_ESCALATE decisions

### Post-Deployment

- [ ] Run post-deployment smoke tests (`smoke-test-production.sh`)
- [ ] Verify all NATS topics publishing events
- [ ] Check failed webhook callback queue (should be empty)
- [ ] Verify CyranoEngines webhook signing working
- [ ] Test feature toggle admin API
- [ ] Confirm audit chain integrity maintained
- [ ] Update status page: "All systems operational"

---

## 7. Incident Response

### 7.1 Dual Integrity Violation (P0)

**Trigger:** `dual.integrity.violation` NATS event with `severity: CRITICAL`

**Response:**

1. **Immediate (< 5 min):**
   - Page on-call SRE and compliance lead
   - Freeze all financial transactions (set GATEGUARD_HARD_DECLINE_THRESHOLD=0)
   - Capture DIA compliance snapshot for forensics
   - Review recent violations: `GET /compliance/dual-integrity/violations`

2. **Investigation (< 30 min):**
   - Identify violation type (GATEGUARD_BYPASS, WELFARE_BYPASS, etc.)
   - Review audit chain for tampering
   - Check for unauthorized code deployments
   - Review database query logs

3. **Remediation:**
   - Rollback if recent deployment caused violation
   - Reset compliance state after verified fix: `POST /compliance/dual-integrity/reset` (admin-only)
   - Re-enable transactions gradually

4. **Post-Incident:**
   - File incident report with correlation_id and violation details
   - Update INFRA_v1.0 policy if new attack vector discovered
   - Add additional monitoring if gap identified

### 7.2 Webhook Callback Storm (P2)

**Trigger:** `failed_callbacks > 50` or `cyranoengines.webhook.failed` rate spike

**Response:**

1. **Identify Root Cause:**
   - Check CyranoEngines service health
   - Verify callback URLs reachable
   - Review recent network changes

2. **Circuit Breaker:**
   - Temporarily disable webhook retries: `WEBHOOK_RETRY_ENABLED=false`
   - Queue jobs for manual processing

3. **Recovery:**
   - Fix upstream issue (CyranoEngines or network)
   - Batch retry failed callbacks: `POST /admin/webhooks/retry-batch`
   - Monitor success rate, re-enable automatic retries

---

## 8. Success Criteria

Phase 11 is production-ready when:

- [✅] All 5 phase items completed
- [✅] CyranoEngines webhook hardening complete (HMAC-SHA256, retry, failed callback storage)
- [✅] OmniSync™ telemetry dashboard operational
- [✅] Synthetic feature toggle engine deployed
- [✅] Dual Integrity Architecture enforcement active
- [✅] All pre-deployment validation checks pass
- [✅] Staging environment end-to-end tests pass
- [✅] Runbooks and incident response procedures documented
- [✅] Monitoring alerts configured in PagerDuty/CloudWatch
- [✅] Rollback procedures tested in staging

---

**Approved for Production Deployment:** [Pending CEO Sign-Off]
**rule_applied_id:** GOLIVE_READINESS_v1.0

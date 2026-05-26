// services/synthetic-twin/REVENUE_MODEL.md

# Synthetic Twin Revenue Sharing Model

**PHASE5-ITEM2**: Revenue sharing logic for CNZ creators consuming SynthiMatesAi services

## Overview

ChatNowZone operates a **resell model** with SynthiMatesAi:

- CNZ consumers purchase synthetic twin services on the CNZ platform
- CNZ calls SynthiMatesAi APIs to fulfill the service
- Revenue from services purchased on CNZ is credited to CNZ creators
- CNZ pays SynthiMatesAi an API fee for each generation
- Platform fee covers CNZ operations and SynthiMatesAi API costs

## Revenue Flow

```
Fan Purchase (10 CZT × $0.09 = $0.90)
│
├─> Creator Earnings (70%) = $0.63
│   └─> Recorded in canonical ledger (LedgerEntry)
│       entry_type: SYNTHETIC_TWIN_EARNINGS
│
└─> Platform Share (30%) = $0.27
    ├─> SynthiMatesAi API Fee = $0.15
    └─> CNZ Platform Fee = $0.12
```

## Pricing Configuration

### Image Generation

- **Cost**: 10 CZT (ChatZone Tokens)
- **Token Value**: $0.09 USD (9¢) per token
- **Total Value**: $0.90 USD (90¢)
- **Creator Share**: 70% → $0.63
- **Platform Share**: 30% → $0.27
  - SynthiMatesAi API Fee: $0.15
  - CNZ Net: $0.12

### Voice Messages (Phase 3)

- **Cost**: 15 CZT
- **Token Value**: $0.09 USD per token
- **Total Value**: $1.35 USD
- **Creator Share**: 70% → $0.95
- **Platform Share**: 30% → $0.41
  - SynthiMatesAi TTS Fee: $0.25 (estimated)
  - CNZ Net: $0.16

### Group Chat Messages (Phase 3)

- **Cost**: 5 CZT per synthetic twin message
- **Token Value**: $0.09 USD per token
- **Total Value**: $0.45 USD
- **Creator Share**: 70% → $0.32
- **Platform Share**: 30% → $0.14

## Implementation Details

### Token Deduction (Three-Bucket Wallet)

Fan tokens are deducted in this priority order:

1. **Bonus Tokens** (promotional/welcome credits)
2. **Membership Tokens** (recurring allocations)
3. **Purchased Tokens** (direct purchases)

```typescript
// Priority deduction example
wallet.bonus_tokens -= 5; // Use bonus first
wallet.membership_tokens -= 3; // Then membership
wallet.purchased_tokens -= 2; // Finally purchased
// Total deducted: 10 CZT
```

### Creator Earnings Recording

Creator earnings are recorded via the canonical ledger:

```typescript
await prisma.ledgerEntry.create({
  data: {
    transaction_ref: `SYNTWIN-EARN-${correlationId}`,
    idempotency_key: `${correlationId}-creator-earnings`,
    user_id: fanUserId,
    performer_id: creatorId,
    entry_type: 'SYNTHETIC_TWIN_EARNINGS',
    status: 'COMPLETED',
    gross_amount_cents: earningsCents, // e.g., 63¢
    fee_amount_cents: BigInt(0), // No additional fee
    net_amount_cents: earningsCents, // Creator receives full 70%
    performer_amount_cents: earningsCents, // Same as net
    platform_amount_cents: BigInt(0), // Platform share tracked separately
    description: 'Creator earnings from Safe Synthetic Twin AI image generation',
    metadata: {
      correlation_id: correlationId,
      service: 'synthetic-twin',
      type: 'ai_image_generation',
    },
  },
});
```

### Platform Share Tracking

The platform's 30% share is tracked in `SyntheticTwinGeneration.platform_share_cents`:

```typescript
const generation = await prisma.syntheticTwinGeneration.create({
  data: {
    // ... other fields
    creator_earnings_cents: BigInt(63), // 70% of 90¢
    platform_share_cents: BigInt(27), // 30% of 90¢
    // Platform share includes:
    // - SynthiMatesAi API fee: 15¢
    // - CNZ net: 12¢
  },
});
```

### SynthiMatesAi API Fee

The API fee paid to SynthiMatesAi is deducted from the platform share:

```typescript
// Constants (should be moved to GovernanceConfig)
CREATOR_SHARE_PERCENT = 0.7       // 70%
PLATFORM_SHARE_PERCENT = 0.3      // 30%
SYNTHIMATES_API_FEE_CENTS = 15    // $0.15 per generation

// Calculation
totalValueCents = tokens × centsPerToken    // 10 × 9 = 90¢
creatorEarnings = totalValueCents × 0.7     // 90¢ × 0.7 = 63¢
platformShare = totalValueCents × 0.3       // 90¢ × 0.3 = 27¢
cnzNet = platformShare - apiFeeCents        // 27¢ - 15¢ = 12¢
```

## Financial Integrity (FIZ Compliance)

All synthetic twin transactions follow OQMI Financial Integrity Zone rules:

### Append-Only Ledger

- **No UPDATE/DELETE** on ledger tables
- All changes are additive (new entries only)
- Enforced via Postgres triggers

### Required Fields

Every financial record includes:

- `correlation_id` - Unique transaction identifier
- `reason_code` - Business reason for the transaction
- `rule_applied_id` - Governance rule version

### Multi-Tenant Isolation

All records include:

- `organization_id` - Organization scope
- `tenant_id` - Tenant scope

### Audit Trail

All transactions emit immutable NATS events:

- `SYNTHETIC_TWIN_GENERATION_STARTED`
- `SYNTHETIC_TWIN_GENERATION_COMPLETED`
- `SYNTHETIC_TWIN_GENERATION_FAILED`
- `CREATOR_EARNINGS_RECORDED`

## Creator Dashboard Display

Creators can view their earnings in real-time via the analytics endpoint:

```typescript
GET /synthetic-twin/analytics/:creatorId

Response:
{
  "totalEarningsCents": 6300,  // $63.00 from 100 generations
  "imageGenerations": {
    "total": 100,
    "completed": 95,
    "failed": 5,
    "earningsCents": 5985  // 95 × 63¢
  },
  "voiceMessages": {
    "total": 20,
    "completed": 20,
    "failed": 0,
    "earningsCents": 1900  // 20 × 95¢
  },
  "groupChatMessages": {
    "total": 10,
    "earningsCents": 320  // 10 × 32¢
  }
}
```

## Payout Settlement

Creator earnings accumulate in the canonical ledger and are settled via:

1. **Diamond Concierge** - High-value creators get priority settlement
2. **FairPay / NOWPayouts** - Regular settlement cycles (bi-weekly or monthly)
3. **Token Bridge** - Optional conversion to external wallets

Settlement frequency and thresholds are governed by:

- Creator tier (Diamond, Platinum, Gold, etc.)
- Total earnings threshold
- Manual payout requests

## Future Enhancements

### Move to GovernanceConfig

Currently hardcoded constants should migrate to `governance.config.ts`:

```typescript
export const SYNTHETIC_TWIN_CONFIG = {
  TOKENS_PER_IMAGE_GENERATION: 10,
  TOKENS_PER_VOICE_MESSAGE: 15,
  TOKENS_PER_GROUP_CHAT_MESSAGE: 5,
  CENTS_PER_TOKEN: 9,
  CREATOR_SHARE_PERCENT: 0.7,
  PLATFORM_SHARE_PERCENT: 0.3,
  SYNTHIMATES_API_FEE_CENTS: 15,
} as const;
```

### Dynamic Pricing

Future phases may introduce:

- Variable pricing based on generation quality
- Premium features (HD images, longer videos)
- Creator-set markup percentages
- Promotional discounts

### Revenue Analytics

Enhanced analytics features:

- Revenue trends over time
- Comparison with other creators
- Forecasting and projections
- Tax reporting exports

## Compliance & Governance

All revenue operations comply with:

- **OQMI Governance Doctrine v2.0** - Append-only finance, correlation IDs
- **FIZ Rules** - No UPDATE on balance columns, offsets only
- **PIPEDA** - Canada-only data residency for financial records
- **INFRA_v1.0** - Secret management, network isolation

---

**Document Version**: 1.0
**Last Updated**: 2026-05-25
**Authority**: OmniQuest Media Inc.
**Rule Applied**: PHASE5_REVENUE_MODEL_v1

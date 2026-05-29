# Safe Synthetic Twin Service

**PHASE2-440**: AI image generation service for ChatNowZone's Safe Synthetic Twin feature.

## Overview

This service implements the Safe Synthetic Twin system that allows fans to generate AI images using a creator's synthetic twin. The service handles:

- Token-based payment (CZT tokens)
- Creator revenue sharing (70/30 split)
- Append-only audit ledger
- Integration with three-bucket wallet system
- Creator earnings tracking

## Architecture

### Current Implementation (MVP Stub)

This is a **minimal viable stub** that implements the financial and business logic flows but uses placeholder ML generation. The actual SafeSyntheticWizard ML pipeline from Synthimate needs to be integrated.

**Implemented:**

- ✅ Token deduction from fan's three-bucket wallet
- ✅ Creator earnings calculation and ledger entries
- ✅ Synthetic twin generation records (append-only)
- ✅ Creator toggle verification
- ✅ Balance checking
- ✅ Audit trail with correlation IDs

**TODO (Synthimate Integration):**

- 🔄 Actual ML image generation pipeline
- 🔄 Multi-image upload and celebrity weighting
- 🔄 Randomized deviation and refinement loop
- 🔄 C2PA watermarking
- 🔄 Curator bot for quality validation
- 🔄 S3/storage integration for generated images

## Database Schema

### Creator Model Extension

```prisma
model Creator {
  // ... existing fields
  synthetic_twin_enabled Boolean @default(false)  // PHASE2-440: Toggle for AI feature
  synthetic_twin_generations SyntheticTwinGeneration[]
}
```

### SyntheticTwinGeneration Table

```prisma
model SyntheticTwinGeneration {
  id                     String   @id
  correlation_id         String   @unique
  user_id                String   // Fan who requested
  creator_id             String   // Creator whose twin was used
  tokens_charged         Int      // CZT tokens deducted
  creator_earnings_cents BigInt   // Creator's share (70%)
  platform_share_cents   BigInt   // Platform's share (30%)
  image_uri              String?  // S3 path to generated image
  status                 String   // PENDING | COMPLETED | FAILED
  // ... governance fields
}
```

## Configuration

### Pricing (GovernanceConfig Integration Needed)

- **Tokens per generation**: 10 CZT (configurable)
- **Token value**: 9¢ USD average (from Diamond Concierge)
- **Creator share**: 70% of token value
- **Platform share**: 30% of token value

### Example Calculation

- Fan pays: 10 CZT tokens
- Value: 10 × $0.09 = $0.90 USD = 90¢
- Creator earns: 63¢ (70%)
- Platform keeps: 27¢ (30%)

## API Usage

```typescript
import { syntheticTwinService } from './synthetic-twin.service';

// Generate AI image
const result = await syntheticTwinService.generateImage({
  userId: 'fan-uuid',
  creatorId: 'creator-uuid',
  prompt: 'Optional text prompt',
  organizationId: 'org-id',
  tenantId: 'tenant-id',
});

// Get creator earnings
const earnings = await syntheticTwinService.getCreatorEarnings('creator-uuid');
console.log(
  `Total earned: ${earnings.totalEarningsCents}¢ from ${earnings.generationCount} generations`,
);

// Get fan's generation history
const history = await syntheticTwinService.getGenerationHistory('fan-uuid');
```

## Compliance & Governance

All operations follow OQMI governance standards:

- ✅ Append-only ledger entries
- ✅ Correlation ID tracking
- ✅ Reason codes on all mutations
- ✅ Rule applied IDs
- ✅ BigInt for all financial amounts (cents)
- ✅ Multi-tenant scoping

## Integration Points

### Required for Full Implementation

1. **Synthimate ML Pipeline** - Replace `simulateImageGeneration()` stub
2. **Storage Service** - S3/assets-service for image storage
3. **GovernanceConfig** - Centralized pricing configuration
4. **NATS Events** - Real-time notifications for generation status
5. **Creator Dashboard** - UI for earnings display
6. **Fan Chat Interface** - "Generate AI Image" button

## Next Steps

1. Integrate actual SafeSyntheticWizard ML pipeline from Synthimate
2. Add NATS event publishing for real-time updates
3. Implement S3/storage integration
4. Add GovernanceConfig constants for pricing
5. Create REST API controller (NestJS)
6. Add rate limiting and cooldown logic
7. Implement C2PA watermarking on generated images

## Testing

```bash
# Generate Prisma client
yarn prisma generate

# Run type checking
yarn typecheck

# Full ship-gate verification
yarn ship-gate
```

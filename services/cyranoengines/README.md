# CyranoEngines - Shared AI Engine Repository

**Status:** Foundation Complete
**Version:** 1.0.0
**Date:** 2026-05-25

## Philosophy

CyranoEngines is a **completely independent** AI engine repository that powers both **SynthiMatesAi** and **ChatNowZone--BUILD** via **webhooks and REST API only**.

### Core Principles

1. **Independence**: CyranoEngines maintains no direct dependencies on either platform
2. **Webhook-Only Integration**: All communication happens via HTTP webhooks/REST API
3. **Asynchronous by Default**: Generation operations return immediately with job_id, results delivered via callback
4. **Correlation Tracking**: Every request accepts `correlation_id` for end-to-end tracking
5. **OQMI Governance**: Follows all OQMI rules (append-only ledger, GateGuard, rule_applied_id)

## Architecture

```
services/cyranoengines/
├── api/                    # Webhook API endpoints
│   └── src/
│       ├── cyranoengines.controller.ts
│       ├── health.controller.ts
│       ├── dto/
│       └── services/
├── image/                  # Safe Synthetic Twin pipeline
│   └── src/
├── video/                  # HeyGen / future internal video
│   └── src/
├── audio/                  # TTS + voice synthesis
│   └── src/
├── memory/                 # Context memory, RAG, summarization
│   └── src/
└── common/                 # Shared services
    └── src/
        ├── learning-loop-capture.service.ts
        ├── studiotokens-charging.service.ts
        ├── gateguard-integration.service.ts
        └── cyranoengines-common.module.ts
```

## API Endpoints

All endpoints accept `correlation_id` in headers (`x-correlation-id`) or body.

### POST /cyranoengines/generate-synthetic-twin

Generates a Safe Synthetic Twin image from input parameters.

**Request Body:**

```json
{
  "input_image": "base64_or_url",
  "parameters": {},
  "callback_url": "https://platform.example.com/webhook/cyranoengines",
  "correlation_id": "uuid-v4",
  "platform": "synthi",
  "account_id": "account-123"
}
```

**Response (202 Accepted):**

```json
{
  "job_id": "uuid-v4",
  "correlation_id": "uuid-v4",
  "status": "accepted",
  "message": "Synthetic twin generation job accepted",
  "estimated_completion_seconds": 30
}
```

**Webhook Callback (on completion):**

```json
{
  "job_id": "uuid-v4",
  "correlation_id": "uuid-v4",
  "status": "completed",
  "result": {
    "output_image_url": "https://...",
    "metadata": {}
  },
  "timestamp": "2026-05-25T..."
}
```

### POST /cyranoengines/generate-video

Generates video content via HeyGen or internal pipeline.

**Request Body:**

```json
{
  "prompt": "Video generation prompt",
  "avatar": "avatar-id",
  "parameters": {},
  "callback_url": "https://platform.example.com/webhook/cyranoengines",
  "correlation_id": "uuid-v4",
  "platform": "cnz",
  "account_id": "account-123"
}
```

**Response:** Same structure as generate-synthetic-twin (202 Accepted)

### POST /cyranoengines/generate-voice

Generates voice/audio content via TTS engine.

**Request Body:**

```json
{
  "text": "Text to synthesize",
  "voice_id": "voice-id",
  "parameters": {},
  "callback_url": "https://platform.example.com/webhook/cyranoengines",
  "correlation_id": "uuid-v4",
  "platform": "synthi",
  "account_id": "account-123"
}
```

**Response:** Same structure as generate-synthetic-twin (202 Accepted)

### POST /cyranoengines/memory/query

Queries context memory, RAG system, or summarization engine.

**Request Body:**

```json
{
  "query": "Search query",
  "context_id": "session-123",
  "limit": 10,
  "callback_url": "https://platform.example.com/webhook/cyranoengines",
  "correlation_id": "uuid-v4",
  "platform": "cnz"
}
```

**Response:** Same structure as generate-synthetic-twin (202 Accepted)

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "service": "cyranoengines-api",
  "timestamp": "2026-05-25T...",
  "version": "1.0.0"
}
```

## StudioTokens Integration

CyranoEngines does **NOT** maintain its own ledger. Instead, it calls back to the platform's ledger service via webhook for charging.

### Charging Flow

1. Operation request received with `account_id` and `platform`
2. CyranoEngines initiates charge via webhook to platform ledger
3. Platform ledger confirms or rejects charge
4. If confirmed, generation proceeds
5. On completion, charge is confirmed via webhook
6. On failure, charge is refunded via webhook

All charges include:

- `correlation_id` for tracking
- `reason_code` for audit trail
- Platform-specific ledger integration

## Data Capture for Internal Learning

CyranoEngines implements a **learning loop capture system** that saves:

- Input images/prompts
- Generation parameters
- Output results
- Success/failure status
- Timestamps and correlation_ids

This data is stored for **future internal model fine-tuning** and continuous improvement.

### Privacy & Compliance

- All captured data includes `correlation_id` for tracking
- Platform identifiers (`synthi` or `cnz`) allow platform-specific training
- Data retention follows OQMI infrastructure policy (Canada-only, PIPEDA-compliant)
- No PII is stored beyond what's necessary for model training

## GateGuard Integration

All generation operations integrate with **GateGuard Sentinel** for:

- Content safety verification
- Compliance checks
- `rule_applied_id` tracking
- Zero-knowledge proof generation (`zk_proof_hash`)

GateGuard verification happens **before** generation and is recorded in the audit trail.

## Development

### Prerequisites

- Node >= 20 (< 23)
- Yarn >= 1.22
- Docker + Docker Compose (for local services)

### Local Development

```bash
# Install dependencies
yarn install --frozen-lockfile

# Build CyranoEngines services
yarn build

# Run health check
curl http://localhost:3000/health
```

### Testing

```bash
# Run tests
yarn test

# Test webhook flow
curl -X POST http://localhost:3000/cyranoengines/generate-synthetic-twin \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: test-correlation-id" \
  -d '{
    "input_image": "test-image-data",
    "callback_url": "https://webhook.site/your-test-url",
    "platform": "synthi",
    "account_id": "test-account"
  }'
```

## Deployment

CyranoEngines follows **OQMI Infrastructure and Security Policy** (INFRA_v1.0):

- **Region:** ca-central-1 (AWS Canada - Montreal)
- **Data Residency:** Canada-only (PIPEDA-compliant)
- **Network:** Private VPC, no public database access
- **Encryption:** TLS 1.2+ in transit, KMS at rest
- **Secrets:** AWS Secrets Manager (never in code)

## Integration Examples

### SynthiMatesAi Integration

```typescript
// SynthiMatesAi calls CyranoEngines
const response = await fetch('https://cyranoengines.example.com/generate-synthetic-twin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-correlation-id': correlationId,
  },
  body: JSON.stringify({
    input_image: imageData,
    callback_url: 'https://synthi.example.com/webhook/cyranoengines',
    platform: 'synthi',
    account_id: userId,
  }),
});

// SynthiMatesAi receives webhook callback
app.post('/webhook/cyranoengines', (req, res) => {
  const { job_id, correlation_id, status, result } = req.body;
  // Process result
});
```

### ChatNowZone--BUILD Integration

```typescript
// ChatNowZone calls CyranoEngines
const response = await fetch('https://cyranoengines.example.com/generate-voice', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-correlation-id': correlationId,
  },
  body: JSON.stringify({
    text: voiceText,
    voice_id: 'default',
    callback_url: 'https://chatnow.zone/webhook/cyranoengines',
    platform: 'cnz',
    account_id: userId,
  }),
});

// ChatNowZone receives webhook callback
app.post('/webhook/cyranoengines', (req, res) => {
  const { job_id, correlation_id, status, result } = req.body;
  // Process result
});
```

## Future Roadmap

### Phase 2 (Post-Foundation)

- [ ] Implement actual Safe Synthetic Twin pipeline integration
- [ ] Integrate HeyGen API for video generation
- [ ] Add ElevenLabs or similar TTS integration
- [ ] Implement vector database for memory/RAG
- [✅] **COMPLETED (Phase 11):** Add retry logic with exponential backoff for webhook callbacks
- [✅] **COMPLETED (Phase 11):** Implement HMAC signature verification for webhooks
- [ ] Add rate limiting per platform/account
- [ ] Implement job queue with Bull/Redis
- [ ] Add comprehensive monitoring and alerting

### Phase 3 (Advanced Features)

- [ ] Fine-tune internal models based on captured data
- [ ] Multi-region deployment for redundancy
- [ ] Advanced RAG with semantic search
- [ ] Custom model training API
- [ ] Real-time generation status streaming

## Phase 11 Enhancements (Production-Ready)

### Webhook Callback Service Hardening

**Location:** `services/cyranoengines/api/src/services/webhook-callback.service.ts`

**Implemented Features:**

- ✅ HMAC-SHA256 signature generation for webhook verification
- ✅ Exponential backoff retry logic (5 retries, 1s-60s backoff with jitter)
- ✅ Failed callback persistence for manual intervention
- ✅ Request timeout enforcement (10 seconds)
- ✅ Manual retry and cleanup endpoints

**Webhook Signature Verification:**
Platforms receiving CyranoEngines webhooks can verify authenticity using:

```typescript
const signature = req.headers['x-cyranoengines-signature'];
const expectedSignature = crypto
  .createHmac('sha256', process.env.CYRANOENGINES_WEBHOOK_SECRET)
  .update(`${job_id}|${correlation_id}|${timestamp}`)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}
```

**Retry Behavior:**

- Attempt 1: Immediate
- Attempt 2: ~1 second later
- Attempt 3: ~2 seconds later
- Attempt 4: ~4 seconds later
- Attempt 5: ~8 seconds later
- Attempt 6: ~16 seconds later
- After max retries: Stored for manual intervention at `/admin/webhooks/failed`

**Environment Variables:**

```bash
CYRANOENGINES_WEBHOOK_SECRET=<256-bit-secret>
```

Generate secret: `openssl rand -hex 32`

## License

Proprietary - OmniQuest Media Inc.

## Contact

For integration questions or support, contact the OmniQuest Media Inc. engineering team.

---

**✅ CyranoEngines foundation is complete and ready. Both SynthiMatesAi and ChatNowZone--BUILD can now call it via webhooks.**

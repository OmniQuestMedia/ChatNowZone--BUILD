# Creator Guide: AI Synthetic Twin Features

## Overview

ChatNow.Zone now offers creators the ability to monetize AI-powered synthetic twin features. These features are **completely optional** and do not affect your existing live streaming, tipping, or private show functionality.

All AI processing is handled by CyranoEngines via secure webhook integration. ChatNow.Zone manages token charging and creator revenue sharing.

---

## Features Available

### 1. AI Image Generation

Fans can request AI-generated images using your synthetic twin persona.

**Pricing**: 10 CZT tokens per generation
**Creator Share**: 70% of token value
**Example**: 10 CZT × $0.09 = $0.90 → You earn $0.63

### 2. Voice Chat with TTS

Fans can have voice conversations with AI responses in your synthetic voice.

**Pricing**: 15 CZT tokens per voice message
**Creator Share**: 70% of token value
**Example**: 15 CZT × $0.09 = $1.35 → You earn $0.95

### 3. Group Chat with AI

Fans can add your synthetic twin to group chats for multi-participant conversations.

**Pricing**: 5 CZT tokens per AI message in group chat
**Creator Share**: 70% of token value
**Example**: 5 CZT × $0.09 = $0.45 → You earn $0.32

---

## How to Enable AI Features

### Step 1: Enable Synthetic Twin in Creator Settings

1. Log into your ChatNow.Zone creator dashboard
2. Navigate to **Settings** → **AI Features**
3. Toggle **"Enable AI Synthetic Twins for Fans"** to ON
4. Review and accept the AI Content Guidelines
5. Click **Save**

### Step 2: Monitor Your AI Earnings

Once enabled, your dashboard will display:

- **Real-time AI earnings** from all synthetic twin interactions
- **Usage analytics** showing which AI features are most popular
- **Top-performing features** ranked by earnings
- **Recent activity** timeline of all AI interactions

### Step 3: Request Payouts

AI earnings are combined with your regular earnings. Request payouts from your dashboard:

1. Go to **Dashboard** → **Earnings**
2. View **Total AI Earnings** section
3. Click **Request Payout**
4. Follow standard payout process

---

## Creator Dashboard Features

### Earnings Overview

Your dashboard shows:

```
Total Earnings: $XXX.XX
  └─ Traditional (Tips, Shows, etc): $XXX.XX
  └─ AI Synthetic Twins: $XXX.XX

AI Features Status: ENABLED ✓

AI Earnings Breakdown:
  └─ Image Generations: XXX completed ($XX.XX)
  └─ Voice Messages: XXX completed ($XX.XX)
  └─ Group Chat Messages: XXX messages ($XX.XX)

Top Performing Feature: IMAGE GENERATION
```

### AI Analytics Dashboard

Access detailed analytics:

- **Total usage** across all AI features
- **Earnings per feature** type
- **Fan engagement** metrics
- **Recent interactions** with correlation IDs for support

---

## How the Webhook Integration Works

### For Creators (High-Level)

1. **Fan requests AI generation** on ChatNow.Zone
2. **ChatNow.Zone deducts tokens** from fan's wallet (10-15 CZT)
3. **ChatNow.Zone credits your earnings** to your ledger (70% share)
4. **ChatNow.Zone calls CyranoEngines** via secure webhook for AI processing
5. **CyranoEngines generates content** (image, voice, etc.)
6. **CyranoEngines calls back** with generated content URI
7. **Fan receives the content** in their chat

### Correlation ID Tracing

Every AI request has a unique `correlation_id` for tracing:

```
SYNTWIN-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Use this ID when contacting support about specific AI interactions.

### Revenue Sharing

All revenue sharing is handled automatically by ChatNow.Zone:

- **70% to creator** (you!)
- **30% to platform** (ChatNow.Zone + CyranoEngines combined)

You don't need to manage any integration with CyranoEngines directly.

---

## Safety and Moderation

### Content Guidelines

All AI-generated content must comply with ChatNow.Zone Community Guidelines:

- No illegal content
- No content violating creator consent
- No harassment or hate speech
- Must follow age-restriction policies

### Moderation Tools

- AI content is automatically flagged for review if it violates policies
- Creators can report problematic AI interactions
- Platform admins review flagged content within 24 hours
- Violating content is removed and users are notified

### Opting Out

You can disable AI features at any time:

1. Go to **Settings** → **AI Features**
2. Toggle **"Enable AI Synthetic Twins for Fans"** to OFF
3. Existing generations remain accessible, but no new requests are accepted

---

## FAQ

### Q: Will enabling AI affect my live streams?

**A:** No. AI features are completely separate from live streaming, OBS integration, and performer tools.

### Q: Do I need to train the AI myself?

**A:** No. CyranoEngines handles all AI training and generation. ChatNow.Zone manages the tokens and earnings.

### Q: How often are AI earnings paid out?

**A:** AI earnings follow the same payout schedule as your regular earnings (weekly/monthly based on your settings).

### Q: Can I customize my synthetic twin's personality?

**A:** Currently, synthetic twins use standard personality templates. Custom personalities may be available in future updates.

### Q: What happens if a fan reports AI content?

**A:** Reported content is reviewed by platform moderators. If found to violate guidelines, it's removed and you're notified. Repeated violations may result in AI features being disabled for your account.

### Q: How do I see which fans are using my AI features?

**A:** Your dashboard's "Recent Activity" shows all AI interactions with user IDs (anonymized for privacy).

---

## Support

For questions or issues with AI features:

- **Technical Support**: support@chatnow.zone
- **Creator Success Team**: creators@chatnow.zone
- **Report Abuse**: abuse@chatnow.zone

Include your `correlation_id` when reporting specific AI interactions.

---

**Last Updated**: 2026-05-25
**Version**: 1.0 (Phase 7 Release)

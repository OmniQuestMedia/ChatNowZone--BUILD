# Safe Synthetic Twin - Creator Guide

## Overview

The Safe Synthetic Twin feature allows creators to offer AI-powered interactions to their fans. This is an **optional** feature that creators can enable in their settings.

## Features

### 1. AI Image Generation
- Fans can generate AI-powered images using your synthetic twin
- Cost: **10 CZT tokens** per generation (~$0.90 USD)
- **You earn 70%** of the token value (~$0.63 per generation)
- Platform keeps 30% for infrastructure and ML processing

### 2. Voice Chat with TTS
- Fans can send voice messages and receive TTS (text-to-speech) responses
- Cost: **5 CZT tokens** for fan voice messages, **8 CZT tokens** for TTS responses
- **You earn 70%** of all voice interaction costs
- Supports ElevenLabs and Banana.dev voice synthesis

### 3. Group Chats with Synthetic Twins
- Fans can create group chats that include your synthetic twin character
- Multiple fans and synthetic twins can participate in one conversation
- Text messages are free; voice messages are charged per the rates above

## How to Enable Safe Synthetic Twin

1. **Log in to your Creator Dashboard**
2. **Navigate to Settings → AI Features**
3. **Toggle "Enable Synthetic Twin" to ON**
4. **Save your settings**

Once enabled:
- Fans will see an "AI Image" button when chatting with you
- Your synthetic twin will appear in the group chat participant list
- You'll start earning from AI interactions immediately

## Analytics Dashboard

View your AI earnings in the Creator Dashboard:

- **Total AI Earnings**: Combined earnings from images and voice
- **Generation Count**: Number of AI images generated
- **Voice Interaction Stats**: Voice messages and TTS responses
- **Top Performing Days**: See which days generated the most revenue
- **Recent Activity Feed**: Real-time view of fan AI interactions

Access at: `/creator/ai-analytics`

### API Endpoints for Analytics

```
GET /ai-analytics/creator/:creatorId
  - Get comprehensive AI analytics

GET /ai-analytics/creator/:creatorId/activity
  - Get recent AI activity feed
```

## Financial Details

### Revenue Sharing
- **Creator Share**: 70% of all token costs
- **Platform Share**: 30% (covers ML processing, storage, infrastructure)

### Token Pricing
- AI Image Generation: 10 CZT
- Fan Voice Message: 5 CZT
- TTS Response: 8 CZT

### Earnings Examples
- 100 AI images = 1,000 CZT spent = $63 to you
- 50 voice conversations (100 messages) = 650 CZT spent = $40.95 to you

### Payout
AI earnings are added to your regular creator earnings and paid out according to the standard payout schedule.

## Best Practices

### 1. Enable Strategically
- Turn on AI features during peak fan engagement times
- Promote the feature to your audience on social media
- Explain to fans how they can use the AI features

### 2. Monitor Analytics
- Check your AI analytics daily
- Identify which features fans use most
- Adjust your promotion strategy based on data

### 3. Quality Control
- AI-generated content is automatically monitored
- Flagged content is reviewed by admins
- You won't lose earnings from removed content (if flagged incorrectly)

## Privacy & Safety

- All AI-generated images are watermarked with C2PA metadata
- Synthetic twins cannot perform actions beyond image/voice generation
- Admin moderation tools monitor for policy violations
- Fans cannot use AI features if you have the toggle disabled

## Disabling the Feature

You can disable Safe Synthetic Twin at any time:

1. Go to Settings → AI Features
2. Toggle "Enable Synthetic Twin" to OFF
3. Save

When disabled:
- Fans cannot generate new AI content using your synthetic twin
- Existing AI conversations are archived
- Your analytics history is preserved
- You can re-enable at any time

## Support

For questions or issues:
- Email: creator-support@chatnow.zone
- In-app support: Creator Dashboard → Help
- Documentation: `/docs/creator-guides/synthetic-twin.md`

## Technical Details (Optional)

### Database Models
- `Creator.synthetic_twin_enabled` — Toggle field
- `SyntheticTwinGeneration` — Image generation records
- `ChatMessage` (message_type: 'VOICE') — Voice chat records
- `Conversation` (conversation_type: 'GROUP') — Group chats

### API Endpoints

**Image Generation:**
```
POST /synthetic-twin/generate
  Body: { userId, creatorId, prompt?, organizationId, tenantId }

GET /synthetic-twin/earnings/:creatorId
  Returns earnings and generation stats
```

**Voice Chat:**
```
POST /voice-chat/send
  Body: { conversationId, senderId, voiceUri?, transcript? }

POST /voice-chat/tts/generate
  Body: { conversationId, syntheticTwinId, textContent, voiceId? }
```

**Group Chat:**
```
POST /group-chat/create
  Body: { creatorId?, title?, initialParticipants }

POST /group-chat/:conversationId/messages
  Body: { senderId, messageType, content }
```

## FAQ

**Q: Does enabling AI affect my live streams?**
A: No. AI features are completely separate from streaming, tipping, and private shows.

**Q: Can fans use AI when I'm offline?**
A: Yes, synthetic twin interactions work 24/7 once enabled.

**Q: What happens if AI generates inappropriate content?**
A: Admins review flagged content. You won't be penalized for AI errors.

**Q: Can I customize my synthetic twin's voice?**
A: Voice customization coming soon. Currently uses default voice profiles.

**Q: How quickly do I get paid for AI earnings?**
A: AI earnings are included in your regular payout cycle.

---

**Last Updated**: May 24, 2026
**Version**: Phase 3 (Voice Chat + Group Chat + Analytics + Moderation)

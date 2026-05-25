# MASTER HOMESTRETCH BUILD QUEUE – ChatNow.Zone Backend + Webcam Completion

**Version:** 1.0 (25 May 2026)  
**Parent:** BUILD_DELTA_CNZ.md (consolidated) + Parity Assessment  
**Status:** ✅ COMPLETE – Alpha Launch Ready (all homestretch phases merged)

## Objective

Complete the **exact remaining backend stack + full webcam / live streaming build** with zero new features. All work stays within existing canonical invariants.

## Merged & Deduplicated Remaining Deltas (no duplication)

### Phase 1: Viewer-Side Live Video Delivery Layer [P0 – Blocker]

- Implement scalable viewer fan-out (Mediasoup preferred or AWS IVS/MediaLive HLS/WebRTC) from existing OBS ingest bridge.
- Adaptive bitrate + quality selector.
- <3s latency for public rooms, scales to hundreds of concurrent viewers.
- Update room service to publish manifests.
- E2E test with test broadcaster.
- Update architecture.md + OQMI_SYSTEM_STATE.md.

### Phase 2: Live Room Backend Orchestration + Webcam Integrations [P0]

- Full live-room session management service (services/live-room/).
- Real-time NATS wiring for chat, tips, toy commands, heat updates (Flicker n’Flame / CrowdSync).
- Lovense haptic bridge fully wired to 3-bucket ledger (atomic).
- Goal progress system + multi-angle support.
- Session state, reconnection, and multi-viewer isolation.

### Phase 3: Private / Group Show Backend

- Booking & isolation logic for 1-on-1 and group sessions.
- Per-minute billing tied to canonical ledger (no new token rules).
- Spy/peek mode backend support.
- Session lifecycle hooks for Whisper (already integrated).

### Phase 4: Final Backend Polish & IaC Hardening

- Production scaling + observability for new streaming service.
- Canada-only residency enforcement on all new services.
- Ship-Gate verification for all webcam flows.
- Update BUILD_DELTA_CNZ.md (or this master file) to “COMPLETE” when done.

## Phase Tracking Links (closure artifacts)

- Phase 2 status: `/home/runner/work/ChatNowZone--BUILD/ChatNowZone--BUILD/PHASE2-440-IMPLEMENTATION-STATUS.md`
- Phase 3 status: `/home/runner/work/ChatNowZone--BUILD/ChatNowZone--BUILD/PHASE3-IMPLEMENTATION-STATUS.md`
- Phase 7 status: `/home/runner/work/ChatNowZone--BUILD/ChatNowZone--BUILD/PHASE7-IMPLEMENTATION-STATUS.md`
- Master readiness summary: `/home/runner/work/ChatNowZone--BUILD/ChatNowZone--BUILD/MASTER_PROJECT_FOLDER.md`

## Acceptance Criteria for Whole Queue

- ✅ All phases closed.
- Full public + private webcam flows working end-to-end.
- ✅ All Ship-Gates remain GREEN.
- ✅ Alpha launch readiness confirmed in `/home/runner/work/ChatNowZone--BUILD/ChatNowZone--BUILD/OQMI_SYSTEM_STATE.md`.
- No breaking changes to ledger, GateGuard, NATS fabric, or compliance layers.

**Labels:** `homestretch`, `priority-1`, `backend`, `webcam`, `streaming`  
**Milestone:** Alpha-Launch-Ready  
**Start Branches:** `feature/live-video-delivery`, `feature/live-room-backend-orchestration`

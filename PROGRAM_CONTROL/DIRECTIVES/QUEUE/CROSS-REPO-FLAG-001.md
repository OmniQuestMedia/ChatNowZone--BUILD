# CROSS-REPO-FLAG-001 — Webhook Contract & eCommsZone Client Dependency Flag

**Document ID:** CROSS-REPO-FLAG-001  
**Authority:** OmniQuest Media Inc. — OQMInc Engineering Team  
**Date:** 2026-05-06  
**Status:** OPEN — awaiting CEO / cross-repo team input  
**Path:** `PROGRAM_CONTROL/DIRECTIVES/QUEUE/CROSS-REPO-FLAG-001.md`  
**Raised by:** Phase 0 WORK-ORDER-v0.1 execution (P0-010, P0-011)  
**Blocking:** Phase 0 exit criteria (eCommsZone integration)

---

## 1. eCommsZone Node.js Client — Package Name Required (P0-010)

**Flag type:** Dependency / package registry

The WORK-ORDER-v0.1 (Phase 0, item P0-010) specifies:

> "Integrate eCommsZone Node.js client as first dependency."

**Current state:** No npm package name for the eCommsZone client has been confirmed or recorded in this repo. The package does not appear in `package.json` and no registry reference exists in `PROGRAM_CONTROL/` or `docs/`.

**Action required (CEO / cross-repo team):**

1. Confirm the npm package name (e.g. `@oqminc/ecommszone-client`, `ecommszone`, etc.)
2. Confirm the version or version constraint to install
3. Confirm whether it is a private npm registry package (and if so, provide registry URL and auth token path in Secrets Manager)

**Resolution:** Once the above is confirmed, the integration agent will run:

```bash
yarn add <package-name>
```

Then update this document's status to `RESOLVED` and update `WORK-ORDER-v0.1.md` P0-010 to `✅ DONE`.

---

## 2. Cross-Repo Webhook Contracts (P0-011)

**Flag type:** Cross-repo API contract

The WORK-ORDER-v0.1 (Phase 0, item P0-011) specifies:

> "Cross-Repo Flag: Confirm webhook contract with eCommsZone, Cyrano, RedRoomRewards."

Per `docs/POLICIES/OQMI_INFRASTRUCTURE_AND_SECURITY_POLICY.md §12`:

> "Webhook contracts with eCommsZone, Cyrano, and RedRoomRewards must be documented in `docs/POLICIES/` before production traffic flows."

### 2a. eCommsZone

| Field                        | Status           |
| ---------------------------- | ---------------- |
| Webhook endpoint(s)          | ⬜ Not confirmed |
| Payload schema (JSON)        | ⬜ Not confirmed |
| HMAC signature header        | ⬜ Not confirmed |
| Auth method                  | ⬜ Not confirmed |
| Retry / idempotency contract | ⬜ Not confirmed |

### 2b. Cyrano

| Field                       | Status                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------- |
| Cyrano API base URL         | ⬜ Not confirmed (service lives at `services/cyrano/` in this repo; external API TBD) |
| Webhook / callback endpoint | ⬜ Not confirmed                                                                      |
| Payout-touching contract    | ⬜ Not confirmed                                                                      |
| Auth method                 | ⬜ Not confirmed                                                                      |

### 2c. RedRoomRewards

| Field                            | Status           |
| -------------------------------- | ---------------- |
| Webhook endpoint(s)              | ⬜ Not confirmed |
| Payload schema (JSON)            | ⬜ Not confirmed |
| HMAC signature header            | ⬜ Not confirmed |
| Auth method                      | ⬜ Not confirmed |
| Settlement / ledger event format | ⬜ Not confirmed |

**Action required (CEO / cross-repo team):**

1. For each of the three integrations above, provide the webhook/API contract (or link to the spec in the corresponding repo)
2. Once confirmed, a follow-on directive will create `docs/POLICIES/WEBHOOK_CONTRACTS.md` with the full specifications
3. Update this document's status to `RESOLVED` and update `WORK-ORDER-v0.1.md` P0-011 to `✅ DONE`

---

## Resolution Checklist

- [ ] eCommsZone npm package name confirmed (§1)
- [ ] eCommsZone npm package added via `yarn add` + `WORK-ORDER-v0.1.md` updated
- [ ] eCommsZone webhook contract confirmed (§2a)
- [ ] Cyrano API/webhook contract confirmed (§2b)
- [ ] RedRoomRewards webhook contract confirmed (§2c)
- [ ] `docs/POLICIES/WEBHOOK_CONTRACTS.md` created
- [ ] This document status updated to `RESOLVED`
- [ ] CEO Phase 0 exit sign-off obtained

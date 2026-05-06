# Pre-Launch Checklist — Canonical Corpus L0 Ship-Gate

**Authority:** OmniQuest Media Inc. — `OQMI_GOVERNANCE.md` (Canonical Corpus v10)
**Branch of record:** `claude/payload10-backend-closure-JpiXh` (Payload 10)
**Hard launch deadline:** 2026-10-01

> Payload 10 (Backend Closure) closed: Risk Engine (D002), FairPay
> PayoutRateLock (PAY-006/011), OBS audio gate (PAY-008/D004), Cyrano L2
> LLM provider (CYR-006), Diamond Concierge intake fields (DIA-003/004).
> Ship-gate verifier: 22/22 PASS.

This checklist is the **L0 ship-gate**. Every line must be verifiable —
either via the automated `ship-gate-verifier.ts` script or by a CEO-signed
clearance in `PROGRAM_CONTROL/CLEARANCES/`. No item may be marked GREEN
on intent alone.

---

## 1. Financial integrity (FIZ)

- [ ] **Three-Bucket Wallet** — `LedgerService.spend` enforces
      `LEDGER_SPEND_ORDER = ['purchased', 'membership', 'bonus']` and
      every debit is verified against the spend-order test (D001).
- [ ] **Append-only ledger** — Postgres triggers in
      `infra/postgres/init-ledger.sql` reject UPDATE/DELETE on
      `ledger_entries`, `transactions`, `audit_events`,
      `referral_links`, `attribution_events`,
      `notification_consent_store`, `game_sessions`, `call_sessions`,
      `voucher_vault`, `content_suppression_queue`, `identity_verification`.
- [ ] **Hash chain integrity** — `LedgerService.record` writes
      `hashCurrent = SHA-256(walletId + correlationId + reasonCode + amount + bucket + metadata + hashPrev)`
      and the verifier walks the chain end-to-end.
- [ ] **Idempotency** — every financial write has `correlation_id`;
      replay returns the original entry unchanged (or rejects on diverging
      payload).
- [ ] **REDBOOK rate cards locked** — `REDBOOK_RATE_CARDS` constants are
      the only source of pricing; ship-gate verifier flags any literal
      price in service code.
- [ ] **Diamond Tier $0.077 platform floor** —
      `DiamondConciergeService.quotePrice` enforces the floor; verified
      in `tests/integration/redbook-rate-card.spec.ts`.

## 2. Welfare + safety (PROC, GATE)

- [ ] **GateGuard pre-process** — every PURCHASE / SPEND / PAYOUT routes
      through `GateGuardMiddleware`. Verifier inspects all controllers
      that touch the ledger.
- [ ] **Welfare Guardian Score** — fraud + welfare bands deterministic
      (`WELFARE_GUARDIAN_v1`); thresholds 40 / 70 / 90 honoured.
- [ ] **Recovery flows** — Token Bridge, Three-Fifths Exit, Expiration
      distribution emit RecoveryAuditEntry with `correlation_id`.
- [ ] **3/5ths Exit policy gate** — `FIZ-002-REVISION-2026-04-11`
      enforced; cash-refund path requires CEO override.
- [ ] **Step-up auth** — `RbacService.authorize` returns
      `step_up_required: true` for `refund:override`,
      `suspension:override`, `ncii:suppress`, `legal_hold:trigger`,
      `geo_block:modify`, `rate_card:configure`, `worm:export`.
- [ ] **48h expiry warning** — `RecoveryEngine.send48HourWarning`
      idempotent within the warning window.

## 3. Compliance + audit (GOV)

- [ ] **Immutable audit chain** — `ImmutableAuditService.record` writes
      monotonic `sequence_number` inside a serialisable transaction;
      `verifyChainIntegrity` walks the chain.
- [ ] **WORM export** — `WormExportService.export` emits a signed bundle
      with the chain state at point of export.
- [x] **Legal hold** — `LegalHoldService.applyHold` / `liftHold` are the
      canonical service entry points; the RBAC `legal_hold:trigger`
      permission gates the controller layer and requires step-up auth
      (see `services/core-api/src/auth/rbac.service.ts` —
      `'legal_hold:trigger': 'TAKEDOWN_SUBMISSION'`). Service-tier:
      `liftHold` rejects any caller whose `caller_role` is not
      `COMPLIANCE`. DB-tier: `legal_holds` is append-only at the
      Postgres tier (lift transition restricted to `lifted_by` /
      `lifted_at_utc` on un-lifted rows; trigger installed by migration
      `20260503000000_legal_holds_append_only_trigger`); every INSERT
      and UPDATE carries `correlation_id` (covered by
- [x] **Legal hold** — `LegalHoldService.trigger` requires step-up auth;
      `legal_holds` table is append-only at the Postgres tier (lift
      transition restricted to `lifted_by` / `lifted_at_utc` on
      un-lifted rows; trigger installed by migration
      `20260503000000_legal_holds_append_only_trigger`); every INSERT and
      UPDATE carries `correlation_id` (covered by
      `tests/integration/legal-hold-correlation-id.spec.ts`).
- [ ] **Geo fencing + sovereign CAC** — block list applied before any
      mutation; blocked actions never reach GateGuard.
- [ ] **PII redaction** — audit payloads redact PII before hash.
- [ ] **Bill 149 disclosure** — every CREATOR_AUTO=true persona output
      prefixed with `BILL_149_DISCLOSURE_PREFIX`.
- [ ] **Banned-entity §12 purge** — no occurrences outside `archive/`.

## 4. Real-time fabric (NATS)

- [ ] NATS JetStream up at `docker-compose.yml`; topic registry at
      `services/nats/topics.registry.ts` is the only source of topic
      names.
- [ ] No REST polling for chat / haptic events.
- [ ] `AUDIT_IMMUTABLE_*` topics emitted on every audit write
      (PAYLOAD 6).
- [ ] `CREATOR_CONTROL_*` and `CYRANO_*` topics emitted from
      services/creator-control + services/cyrano (PAYLOAD 5).

## 5. Frontend (PAYLOAD 7)

- [ ] **Diamond Concierge Command Center** at `/admin/diamond` —
      liquidity + 48h queue + personal-touch + Token Bridge +
      Three-Fifths Exit + GateGuard feed + Welfare panel + audit chain.
- [ ] **CS Recovery Command Center** at `/admin/recovery` — open-case
      table + audit trail + per-stage counts.
- [ ] **CreatorControl.Zone** at `/creator/control` — Broadcast Timing
      Copilot + Session Monitoring + Cyrano whisper panel + Flicker n'Flame Scoring
      meter + persona switcher + payout indicator.
- [ ] **Guest token bundles** at `/tokens` — REDBOOK §3 rate card
      (Tease Regular + ShowZone Premium).
- [ ] **Diamond purchase** at `/diamond/purchase` — volume + velocity
      quote with platform-floor flag.
- [ ] **Wallet** at `/wallet` — three-bucket display with deterministic
      spend order + safety-net offer.
- [ ] **Dark mode default** — adult-platform standard (`THEME.default_mode = 'dark'`).
- [ ] **SEO + canonical branding** — `ui/config/seo.ts` populated for
      all public routes; admin/wallet routes `noindex,nofollow`.
- [ ] **Accessibility** — every interactive node has `test_id` + ARIA
      label; breakpoints 375 / 768 / 1280 / 1680 documented in
      `ui/config/accessibility.ts`.

## 6. Build + test gates

- [ ] `yarn lint` — zero warnings (`--max-warnings 0`).
- [ ] `yarn typecheck` — exit 0 (root + `:api`).
- [ ] `yarn test` — full Jest integration + unit suite green.
- [ ] `yarn prisma:generate` — succeeds with no schema drift.
- [ ] `yarn format:check` — Prettier clean across the tree.
- [ ] `yarn build` — top-level build exits 0 (currently delegated to
      `tsc` until the Next.js app bootstraps).
- [ ] **End-to-end suite** at `tests/e2e/` covers:
      token purchase → three-bucket allocation → GateGuard pre-process
      → ledger mutation; high-heat session → Cyrano suggestion → scaled
      payout; Diamond recovery flows (Token Bridge + 3/5ths Exit);
      expiration + redistribution; immutable audit chain replay; RBAC +
      step-up enforcement.

## 7. Operations + deployment

- [ ] Postgres (5432) + Redis (6379) bound to internal `backend`
      network only — `docker-compose.yml` audited.
- [ ] No secrets in repo — `find -name .env*` clean outside
      `.gitignore`d locals.
- [ ] `.gitignore` covers `*.env.local`, `*.env.*.local`,
      `node_modules/`, `dist/`, `.next/`.
- [ ] `infra/postgres/init-ledger.sql` triggers verified post-deploy
      via the verifier.
- [ ] CI workflows green: `ci.yml`, `super-linter.yml`, `codeql.yml`,
      `repo-manifest.yml`.
- [ ] `OQMI_SYSTEM_STATE.md` snapshot updated with launch state.
- [ ] `docs/REQUIREMENTS_MASTER.md` reflects current Wave A–H status.

## 8. Governance + authority

- [ ] CEO sign-off in `PROGRAM_CONTROL/CLEARANCES/` for every GOV gate.
- [ ] `PROGRAM_CONTROL/REPO_MANIFEST.md` regenerated.
- [ ] `OQMI_SYSTEM_STATE.md` Section 4 (L0 Ship-Gate) all DONE.

---

## How to verify

```bash
yarn install --frozen-lockfile
yarn prisma:generate
yarn lint
yarn typecheck
yarn test
ts-node PROGRAM_CONTROL/ship-gate-verifier.ts
```

The `ship-gate-verifier.ts` script reads this checklist and the
canonical compliance checklist at
`PROGRAM_CONTROL/CANONICAL_COMPLIANCE_CHECKLIST.md`, surfaces any
unmet invariants with file:line references, and exits non-zero if any
invariant is violated.

---

## Sign-off

| Role             | Name               | Date               | Signature          |
| ---------------- | ------------------ | ------------------ | ------------------ |
| CEO              | Kevin B. Hartley   | **\*\***\_**\*\*** | **\*\***\_**\*\*** |
| Engineering Lead | **\*\***\_**\*\*** | **\*\***\_**\*\*** | **\*\***\_**\*\*** |
| Compliance       | **\*\***\_**\*\*** | **\*\***\_**\*\*** | **\*\***\_**\*\*** |
| Customer Success | **\*\***\_**\*\*** | **\*\***\_**\*\*** | **\*\***\_**\*\*** |

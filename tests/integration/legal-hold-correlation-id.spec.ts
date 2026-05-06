// tests/integration/legal-hold-correlation-id.spec.ts
// Coverage for the §7 / Wave H invariant: every legal_holds INSERT and
// every lift UPDATE must carry a correlation_id, and the lift must publish
// both the original (apply) and the lift correlation_ids on the NATS event
// so AuditBridgeService can replay the chain.
import { LegalHoldService } from '../../services/core-api/src/compliance/legal-hold.service';
import { NATS_TOPICS } from '../../services/nats/topics.registry';

class StubNats {
  public readonly published: Array<{ topic: string; payload: Record<string, unknown> }> = [];
  publish(topic: string, payload: Record<string, unknown>): void {
    this.published.push({ topic, payload });
  }
  subscribe(): void {
    /* no-op */
  }
}

interface Row {
  id: string;
  hold_id: string;
  subject_id: string;
  subject_type: string;
  applied_by: string;
  applied_at_utc: Date;
  lifted_by: string | null;
  lifted_at_utc: Date | null;
  reason_code: string;
  correlation_id: string;
  rule_applied_id: string;
  created_at: Date;
}

class StubPrisma {
  public readonly rows: Row[] = [];
  legalHold = {
    create: async ({
      data,
    }: {
      data: Omit<Row, 'id' | 'created_at' | 'lifted_by' | 'lifted_at_utc'> &
        Partial<Pick<Row, 'lifted_by' | 'lifted_at_utc'>>;
    }) => {
      const row: Row = {
        id: `db-${this.rows.length + 1}`,
        hold_id: data.hold_id,
        subject_id: data.subject_id,
        subject_type: data.subject_type,
        applied_by: data.applied_by,
        applied_at_utc: data.applied_at_utc,
        lifted_by: data.lifted_by ?? null,
        lifted_at_utc: data.lifted_at_utc ?? null,
        reason_code: data.reason_code,
        correlation_id: data.correlation_id,
        rule_applied_id: data.rule_applied_id,
        created_at: new Date(),
      };
      this.rows.push(row);
      return row;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      return (
        this.rows.find(
          (r) =>
            r.subject_id === where.subject_id &&
            r.subject_type === where.subject_type &&
            (where.lifted_at_utc === null ? r.lifted_at_utc === null : true),
        ) ?? null
      );
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { lifted_by: string; lifted_at_utc: Date };
    }) => {
      const row = this.rows.find((r) => r.id === where.id);
      if (!row) throw new Error('not found');
      row.lifted_by = data.lifted_by;
      row.lifted_at_utc = data.lifted_at_utc;
      return row;
    },
  };
}

function buildSvc() {
  const nats = new StubNats();
  const prisma = new StubPrisma();
  const svc = new LegalHoldService(nats as never, prisma as never);
  return { svc, nats, prisma };
}

describe('LegalHoldService — correlation_id invariant', () => {
  it('persists correlation_id on apply and emits it on the NATS event', async () => {
    const { svc, nats, prisma } = buildSvc();
    const corr = 'corr-apply-' + 'a'.repeat(20);
    const record = await svc.applyHold({
      subject_id: 'user-1',
      subject_type: 'USER',
      applied_by: 'compliance-officer-1',
      reason_code: 'COMPLIANCE_INVESTIGATION',
      correlation_id: corr,
    });

    expect(record.correlation_id).toBe(corr);
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0].correlation_id).toBe(corr);
    expect(prisma.rows[0].lifted_at_utc).toBeNull();

    const evt = nats.published.find((p) => p.topic === NATS_TOPICS.LEGAL_HOLD_APPLIED);
    expect(evt).toBeDefined();
    expect(evt?.payload.correlation_id).toBe(corr);
    expect(evt?.payload.actor_role).toBe('compliance');
  });

  it('lift emits both the apply and the lift correlation_ids and updates only lift fields', async () => {
    const { svc, nats, prisma } = buildSvc();
    const applyCorr = 'corr-apply-' + 'b'.repeat(20);
    const liftCorr = 'corr-lift-' + 'c'.repeat(20);

    await svc.applyHold({
      subject_id: 'content-7',
      subject_type: 'CONTENT',
      applied_by: 'compliance-officer-2',
      reason_code: 'TAKEDOWN_NOTICE',
      correlation_id: applyCorr,
    });

    const lifted = await svc.liftHold({
      subject_id: 'content-7',
      subject_type: 'CONTENT',
      lifted_by: 'compliance-officer-3',
      reason_code: 'HOLD_LIFTED_AFTER_REVIEW',
      correlation_id: liftCorr,
      caller_role: 'COMPLIANCE',
    });

    expect(lifted.correlation_id).toBe(applyCorr);
    expect(lifted.lifted_by).toBe('compliance-officer-3');
    expect(prisma.rows[0].lifted_by).toBe('compliance-officer-3');
    expect(prisma.rows[0].lifted_at_utc).not.toBeNull();
    // The original correlation_id on the row is preserved (append-only).
    expect(prisma.rows[0].correlation_id).toBe(applyCorr);

    const evt = nats.published.find((p) => p.topic === NATS_TOPICS.LEGAL_HOLD_LIFTED);
    expect(evt).toBeDefined();
    expect(evt?.payload.correlation_id_apply).toBe(applyCorr);
    expect(evt?.payload.correlation_id_lift).toBe(liftCorr);
    expect(evt?.payload.correlation_id).toBe(liftCorr);
  });

  it('rejects lift attempts from non-COMPLIANCE callers', async () => {
    const { svc } = buildSvc();
    await svc.applyHold({
      subject_id: 'tx-9',
      subject_type: 'TRANSACTION',
      applied_by: 'compliance-officer-1',
      reason_code: 'CHARGEBACK_INVESTIGATION',
      correlation_id: 'corr-' + 'd'.repeat(36),
    });

    await expect(
      svc.liftHold({
        subject_id: 'tx-9',
        subject_type: 'TRANSACTION',
        lifted_by: 'creator-control-bot',
        reason_code: 'PREMATURE_LIFT_ATTEMPT',
        correlation_id: 'corr-' + 'e'.repeat(36),
        caller_role: 'CREATOR_CONTROL',
      }),
    ).rejects.toThrow(/LEGAL_HOLD_UNAUTHORIZED/);
  });
});

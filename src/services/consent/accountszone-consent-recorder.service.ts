import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface ImmutableConsentRecordInput {
  accountId: string;
  characterId: string;
  consentType: 'twin' | 'fantasy';
  consentText: string;
  ip: string;
  userSignature?: string;
}

export interface ImmutableConsentRecord {
  accountId: string;
  characterId: string;
  consentType: 'twin' | 'fantasy';
  consentTextHash: string;
  timestamp: Date;
  ip: string;
  userSignature?: string;
}

export class AccountsZoneConsentRecorderService {
  async recordConsent(input: ImmutableConsentRecordInput): Promise<ImmutableConsentRecord> {
    const timestamp = new Date();
    const consentTextHash = createHash('sha256')
      .update(input.consentText)
      .update(input.accountId)
      .update(input.characterId)
      .update(input.consentType)
      .update(timestamp.toISOString())
      .digest('hex');

    await prisma.auditEvent.create({
      data: {
        event_type: 'SYNTHETIC_TWIN_CONSENT_RECORDED',
        actor_id: input.accountId,
        performer_id: input.characterId,
        purpose_code: `SYNTHETIC_TWIN_${input.consentType.toUpperCase()}_CONSENT`,
        outcome: 'ACCEPTED',
        reason_code: 'SYNTHETIC_TWIN_CONSENT',
        consent_basis_id: consentTextHash,
        metadata: {
          accountId: input.accountId,
          characterId: input.characterId,
          consentType: input.consentType,
          consentTextHash,
          timestamp: timestamp.toISOString(),
          ip: input.ip,
          userSignature: input.userSignature ?? null,
          immutable_store: 'ACCOUNTS_ZONE_AUDIT_EVENTS',
        },
      },
    });

    return {
      accountId: input.accountId,
      characterId: input.characterId,
      consentType: input.consentType,
      consentTextHash,
      timestamp,
      ip: input.ip,
      userSignature: input.userSignature,
    };
  }
}

export const accountsZoneConsentRecorder = new AccountsZoneConsentRecorderService();

// services/core-api/src/compliance/compliance.module.ts — Phase 11 Enhanced
import { Module } from '@nestjs/common';
import { NatsModule } from '../nats/nats.module';
import { WormExportService } from './worm-export.service';
import { AuditChainService } from './audit-chain.service';
import { LegalHoldService } from './legal-hold.service';
import { ReconciliationService } from './reconciliation.service';
import { DualIntegrityEnforcementService } from './dual-integrity-enforcement.service';

@Module({
  imports: [NatsModule],
  providers: [
    WormExportService,
    AuditChainService,
    LegalHoldService,
    ReconciliationService,
    DualIntegrityEnforcementService,
  ],
  exports: [
    WormExportService,
    AuditChainService,
    LegalHoldService,
    ReconciliationService,
    DualIntegrityEnforcementService,
  ],
})
export class ComplianceModule {}

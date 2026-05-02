// services/creator-onboarding/src/pixel-legacy.controller.ts
// PIXEL-LEGACY-001 — Pixel Legacy onboarding HTTP surface.
//
// Endpoints:
//   POST /pixel-legacy/apply         creator submits / re-submits
//   POST /pixel-legacy/review        operator GRANT or DENY (RBAC-gated)
//   GET  /pixel-legacy/seat-meter    seat-availability snapshot
//   GET  /pixel-legacy/:creator_id   creator's application + seat (presenter)

import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
import { PixelLegacyService } from './pixel-legacy.service';
import {
  ApplyPixelLegacyDto,
  PixelLegacyApplicationPublic,
  PixelLegacySeatAllocationPublic,
  ReviewPixelLegacyDto,
} from './dto/pixel-legacy.dto';
import { PIXEL_LEGACY } from '../../core-api/src/config/governance.config';

@Controller('pixel-legacy')
export class PixelLegacyController {
  private readonly logger = new Logger(PixelLegacyController.name);

  constructor(private readonly pixelLegacy: PixelLegacyService) {}

  @Post('apply')
  async apply(@Body() dto: ApplyPixelLegacyDto): Promise<PixelLegacyApplicationPublic> {
    this.logger.log('PixelLegacyController.apply', {
      creator_id: dto.creator_id,
      portfolio_count: dto.portfolio_entries?.length ?? 0,
      correlation_id: dto.correlation_id,
    });
    return this.pixelLegacy.applyForPixelLegacy(dto);
  }

  @Post('review')
  async review(@Body() dto: ReviewPixelLegacyDto): Promise<{
    application: PixelLegacyApplicationPublic;
    seat_allocation: PixelLegacySeatAllocationPublic | null;
  }> {
    this.logger.log('PixelLegacyController.review', {
      application_id: dto.application_id,
      decision: dto.decision,
      reviewer_id: dto.reviewer_id,
      caller_role: dto.caller_role,
      correlation_id: dto.correlation_id,
    });
    return this.pixelLegacy.reviewApplication(dto);
  }

  @Get('seat-meter')
  async seatMeter(): Promise<{
    seats_taken: number;
    seats_total: number;
    seats_remaining: number;
    cap_reached: boolean;
    rule_applied_id: string;
  }> {
    const meter = await this.pixelLegacy.getSeatMeter();
    return { ...meter, rule_applied_id: PIXEL_LEGACY.RULE_APPLIED_ID };
  }

  @Get(':creator_id')
  async getByCreator(
    @Param('creator_id') creatorId: string,
  ): Promise<PixelLegacyApplicationPublic | { found: false }> {
    const row = await this.pixelLegacy.getApplication(creatorId);
    return row ?? { found: false };
  }
}

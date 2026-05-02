// services/creator-onboarding/src/pixel-legacy.controller.ts
// PIXEL-LEGACY-001 — Pixel Legacy onboarding HTTP surface.
//
// Endpoints:
//   POST /pixel-legacy/apply         creator submits / re-submits
//   POST /pixel-legacy/review        operator GRANT or DENY (RBAC-gated in service)
//   GET  /pixel-legacy/seat-meter    seat-availability snapshot (public)
//   GET  /pixel-legacy/:creator_id   full PixelLegacyApplicationView for the UI
//
// Auth posture (interim):
//   reviewer_id and caller_role on the review endpoint are accepted from the
//   request body. The service routes the role check through the canonical
//   RbacGuard, so role-based denial uses the same role-rank logic as the rest
//   of the codebase. This matches the existing pattern in studio.controller
//   and creator-onboarding.controller. Once the platform auth middleware
//   lands and attaches a verified user to the request, both fields will be
//   sourced from req.user and the body fields will be removed. Tracked under
//   PIXEL-LEGACY-006 alongside the step-up auth modal flow.

import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
import {
  PixelLegacyApplicationView,
  PixelLegacyService,
} from './pixel-legacy.service';
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

  /**
   * Returns the full PixelLegacyApplicationView for the UI binding at
   * ui/app/creator/pixel-legacy/page.ts. For first-time visits with no
   * application row yet, returns a synthetic DRAFT view so the UI has a
   * coherent shape to render the apply form against.
   */
  @Get(':creator_id')
  async getViewByCreator(
    @Param('creator_id') creatorId: string,
  ): Promise<PixelLegacyApplicationView> {
    return this.pixelLegacy.buildApplicationView(creatorId);
  }
}

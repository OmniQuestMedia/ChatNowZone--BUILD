// services/creator-onboarding/src/pixel-legacy.controller.ts
// PIXEL-LEGACY-002 — read-only HTTP surface for the FCFS gateway.
//
// Endpoints:
//   GET  /pixel-legacy/seat-meter         public seat-availability snapshot
//                                         (clamped at MARKETING_SEAT_CAP).
//   GET  /pixel-legacy/:creator_id        creator's Pixel Legacy status
//                                         (drives the /creator/pixel-legacy
//                                         status page).
//
// There is no apply or review endpoint — Pixel Legacy is granted automatically
// at onboarding completion via CreatorOnboardingService.complete() →
// PixelLegacyService.tryGrantSeatOnOnboarding().
//
// Auth posture (interim, tracked PIXEL-LEGACY-006):
//   /pixel-legacy/:creator_id currently allows reads by creator_id alone.
//   Once the platform auth middleware lands and attaches a verified user to
//   the request, the controller will enforce that the caller is either the
//   creator themselves or a permitted operator before returning the status
//   shape. The status payload at present is a small set of public-derivable
//   facts (is_pixel_legacy boolean + seat number) — much less sensitive than
//   the application proof statements + portfolio entries that the v1 surface
//   exposed, so the auth gap is lower-urgency than it was under -001.

import { Controller, Get, Param } from '@nestjs/common';
import { PixelLegacyService } from './pixel-legacy.service';
import {
  PixelLegacyCreatorStatusPublic,
  PixelLegacySeatMeterPublic,
} from './dto/pixel-legacy.dto';

@Controller('pixel-legacy')
export class PixelLegacyController {
  constructor(private readonly pixelLegacy: PixelLegacyService) {}

  @Get('seat-meter')
  async seatMeter(): Promise<PixelLegacySeatMeterPublic> {
    return this.pixelLegacy.getSeatMeter();
  }

  @Get(':creator_id')
  async getCreatorStatus(
    @Param('creator_id') creatorId: string,
  ): Promise<PixelLegacyCreatorStatusPublic> {
    return this.pixelLegacy.getCreatorStatus(creatorId);
  }
}

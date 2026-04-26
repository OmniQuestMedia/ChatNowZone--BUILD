// WO-003 — Room-Heat Engine: controller
// REST surface for the Room-Heat Engine service.
// All endpoints are advisory / read-oriented; no ledger mutations here.
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { LeaderboardCategory } from './types/ffs.types';
import type { FfsLeaderboard, FfsScore } from './types/ffs.types';
import { IngestFfsDto, TipEventDto } from './dto/ffs.dto';
import { FlickerNFlameScoringService } from './ffs.service';

@Controller('ffs')
export class FlickerNFlameScoringController {
  private readonly logger = new Logger(FlickerNFlameScoringController.name);

  constructor(private readonly flickerNFlameScoringService: FlickerNFlameScoringService) {}

  /**
   * GET /ffs/leaderboard?category=all|standard|dual_flame|hot_and_ready|new_flames
   *
   * Returns the 10×10 leaderboard grid.
   * Coolest sessions appear at the top (rank 0); hottest at the bottom (rank 99).
   */
  @Get('leaderboard')
  getLeaderboard(
    @Query('category') category?: string,
  ): FfsLeaderboard {
    const validCategories: LeaderboardCategory[] = [
      'all',
      'standard',
      'dual_flame',
      'hot_and_ready',
      'new_flames',
    ];
    const cat: LeaderboardCategory = validCategories.includes(
      category as LeaderboardCategory,
    )
      ? (category as LeaderboardCategory)
      : 'all';

    this.logger.log('FlickerNFlameScoringController.getLeaderboard', { category: cat });
    return this.flickerNFlameScoringService.getLeaderboard(cat);
  }

  /**
   * GET /ffs/session/:sessionId
   *
   * Returns the current heat score for a live session, or 404 if unknown.
   */
  @Get('session/:sessionId')
  getSessionHeat(
    @Param('sessionId') sessionId: string,
  ): FfsScore | { message: string; session_id: string } {
    const score = this.flickerNFlameScoringService.getSessionHeat(sessionId);
    if (!score) {
      return { message: 'Session not found or not yet active', session_id: sessionId };
    }
    return score;
  }

  /**
   * POST /ffs/ingest
   *
   * Ingest a full telemetry frame. Returns the computed heat score.
   * Used by the creator-control surface and integration tests.
   */
  @Post('ingest')
  ingestSample(@Body() dto: IngestFfsDto): FfsScore {
    this.logger.log('FlickerNFlameScoringController.ingestSample', {
      session_id: dto.session_id,
      creator_id: dto.creator_id,
    });
    return this.flickerNFlameScoringService.ingest(dto);
  }

  /**
   * POST /ffs/session/:sessionId/start
   *
   * Pre-register a session before the first telemetry frame.
   * Callers may omit this — the session is auto-registered on first ingest.
   */
  @Post('session/:sessionId/start')
  startSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { creator_id: string; is_dual_flame?: boolean },
  ): { session_id: string; started: boolean } {
    this.flickerNFlameScoringService.startSession(
      sessionId,
      body.creator_id,
      body.is_dual_flame ?? false,
    );
    return { session_id: sessionId, started: true };
  }

  /**
   * DELETE /ffs/session/:sessionId
   *
   * Teardown session heat state and stop the 1 Hz publisher.
   * Call this when a broadcast ends.
   */
  @Delete('session/:sessionId')
  endSession(
    @Param('sessionId') sessionId: string,
  ): { session_id: string; ended: boolean } {
    this.flickerNFlameScoringService.endSession(sessionId);
    return { session_id: sessionId, ended: true };
  }

  /**
   * POST /ffs/tip-event
   *
   * Trigger adaptive weight learning from a tip event.
   * Called by the tip service whenever a tip is completed.
   */
  @Post('tip-event')
  recordTipEvent(@Body() dto: TipEventDto): { learned: boolean } {
    this.logger.log('FlickerNFlameScoringController.recordTipEvent', {
      session_id: dto.session_id,
      creator_id: dto.creator_id,
      tokens:     dto.tokens,
    });
    this.flickerNFlameScoringService.learnFromTipEvent(dto.heat_context);
    return { learned: true };
  }

  /**
   * GET /ffs/adaptive-weights/:creatorId
   *
   * Returns the adaptive weight multipliers for a creator (advisory / debug).
   */
  @Get('adaptive-weights/:creatorId')
  getAdaptiveWeights(
    @Param('creatorId') creatorId: string,
  ) {
    return this.flickerNFlameScoringService.getAdaptiveWeightsPublic(creatorId);
  }
}

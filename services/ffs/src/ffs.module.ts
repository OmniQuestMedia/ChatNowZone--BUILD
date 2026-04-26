// WO-003 — Room-Heat Engine: module
// Business Plan B.4 — real-time composite heat score service.
// NatsModule and PrismaModule are global — no local import needed.
import { Module } from '@nestjs/common';
import { FlickerNFlameScoringController } from './ffs.controller';
import { FlickerNFlameScoringService } from './ffs.service';

@Module({
  controllers: [FlickerNFlameScoringController],
  providers:   [FlickerNFlameScoringService],
  exports:     [FlickerNFlameScoringService],
})
export class FlickerNFlameScoringModule {}

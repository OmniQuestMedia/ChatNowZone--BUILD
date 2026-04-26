// WO-003 — Flicker n'Flame Scoring (FFS): module
// @deprecated — Use services/ffs/src/ffs.module.ts (FfsModule) instead.
// This module is retained for reference only. All new code should import FfsModule.
// Business Plan B.4 — real-time composite heat score service.
// NatsModule and PrismaModule are global — no local import needed.
import { Module } from '@nestjs/common';
import { RoomHeatController } from './room-heat.controller';
import { RoomHeatService } from './room-heat.service';

@Module({
  controllers: [RoomHeatController],
  providers:   [RoomHeatService],
  exports:     [RoomHeatService],
})
export class RoomHeatModule {}

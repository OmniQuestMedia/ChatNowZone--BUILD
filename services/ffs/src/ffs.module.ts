// Flicker n'Flame Scoring (FFS) — module
// Business Plan B.4 — real-time composite heat score service.
// NatsModule and PrismaModule are global — no local import needed.
import { Module } from '@nestjs/common';
import { FfsController } from './ffs.controller';
import { FfsService } from './ffs.service';

@Module({
  controllers: [FfsController],
  providers:   [FfsService],
  exports:     [FfsService],
})
export class FfsModule {}

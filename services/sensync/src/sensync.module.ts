// HZ: SenSync™ module
import { Module } from '@nestjs/common';
import { SenSyncController } from './sensync.controller';
import { SenSyncService } from './sensync.service';

@Module({
  controllers: [SenSyncController],
  providers: [SenSyncService],
  exports: [SenSyncService],
})
export class SenSyncModule {}

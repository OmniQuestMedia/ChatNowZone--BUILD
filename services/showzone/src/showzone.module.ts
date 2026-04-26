// @deprecated — ShowZone service removed (see CNZ-WORK-001 Section 1). Retained for reference only.
// services/showzone/src/showzone.module.ts
import { Module } from '@nestjs/common';
import { RoomSessionService } from './room-session.service';

@Module({
  providers: [RoomSessionService],
  exports: [RoomSessionService],
})
export class ShowZoneModule {}

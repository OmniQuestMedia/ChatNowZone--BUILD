// @deprecated — ShowZone service removed (see CNZ-WORK-001 Section 1). Retained for reference only.
// services/showzone/src/showzone.module.ts
// @deprecated SHOWZONE-DEPRECATED — ShowZone service is deprecated as of post-April 2026.
// All ShowToken creation, conversion, and allotment logic is removed.
// Room lifecycle state that was ShowZone-specific (DRAFT → SCHEDULED → LIVE → ENDED)
// is now owned by the Bijou Play.Zone scheduler (services/bijou/).
// This module remains for reference only and is no longer registered in AppModule.
import { Module } from '@nestjs/common';
import { RoomSessionService } from './room-session.service';

@Module({
  providers: [RoomSessionService],
  exports: [RoomSessionService],
})
export class ShowZoneModule {}

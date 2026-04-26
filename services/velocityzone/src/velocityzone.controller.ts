// services/velocityzone/src/velocityzone.controller.ts
// VelocityZone — admin REST endpoints for managing time-window payout boost events.
// All routes are admin-only (enforced by RBAC middleware in app gateway).

import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { VelocityZoneService } from './velocityzone.service';
import type { CreateVelocityZoneEventDto } from './velocityzone.types';

@Controller('velocityzone')
export class VelocityZoneController {
  constructor(private readonly velocityzone: VelocityZoneService) {}

  /** List all upcoming and active VelocityZone events. */
  @Get('events')
  listEvents() {
    return this.velocityzone.listActiveAndUpcoming();
  }

  /** Create a new VelocityZone event window. Admin-only. */
  @Post('events')
  createEvent(@Body() dto: CreateVelocityZoneEventDto) {
    return this.velocityzone.createEvent(dto);
  }

  /** Deactivate an event early. Admin-only. */
  @Patch('events/:id/deactivate')
  deactivateEvent(
    @Param('id') id: string,
    @Body('correlation_id') correlationId: string,
  ) {
    return this.velocityzone.deactivateEvent(id, correlationId);
  }
}

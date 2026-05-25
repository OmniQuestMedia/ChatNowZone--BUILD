import { Controller, Get } from '@nestjs/common';

/**
 * Health Check Controller
 *
 * Provides basic health check endpoint for monitoring and testing.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'cyranoengines-api',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}

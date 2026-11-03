import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  private readonly bootedAt = Date.now();

  @Get()
  check() {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.bootedAt) / 1000),
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION,
    };
  }
}

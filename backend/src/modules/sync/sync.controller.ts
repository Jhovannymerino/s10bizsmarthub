import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * POST /sync/push
   * Endpoint para el agente local — autenticado con x-sync-key header
   */
  @Post('push')
  async push(
    @Headers('x-sync-key') syncKey: string,
    @Body() payload: any,
  ) {
    const expectedKey = process.env.SYNC_API_KEY;
    if (!expectedKey || syncKey !== expectedKey) {
      throw new UnauthorizedException('Invalid sync key');
    }
    return this.syncService.processPush(payload);
  }

  /**
   * POST /sync/ledger
   * Recibe chunks del libro mayor desde el agente — autenticado con x-sync-key.
   * isFirst dispara el reemplazo por (companyId, anio); el resto hace append.
   */
  @Post('ledger')
  async ledger(
    @Headers('x-sync-key') syncKey: string,
    @Body() payload: any,
  ) {
    const expectedKey = process.env.SYNC_API_KEY;
    if (!expectedKey || syncKey !== expectedKey) {
      throw new UnauthorizedException('Invalid sync key');
    }
    return this.syncService.processLedgerChunk(payload);
  }

  /**
   * POST /sync/trigger
   * Trigger manual via VPN script — requiere JWT
   */
  @Post('trigger')
  @UseGuards(JwtAuthGuard)
  async trigger(@Query('years') years?: string, @Query('fast') fast?: string) {
    const yearList = years
      ? years.split(',').map(Number).filter(Boolean)
      : [new Date().getFullYear()];
    return this.syncService.triggerVpnSync(yearList, fast === 'true' || fast === '1');
  }

  /**
   * GET /sync/status
   * Estado actual del sync (running o no) — requiere JWT
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status() {
    return this.syncService.getVpnSyncStatus();
  }
}

import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { NarrativeService } from './narrative.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('kpi')
@UseGuards(JwtAuthGuard)
export class NarrativeController {
  constructor(private narrative: NarrativeService) {}

  @Get(':companyId/narrative')
  async getNarrative(
    @Param('companyId') companyId: string,
    @Query('year') year: string,
    @Query('force') force: string,
  ) {
    const y = parseInt(year) || new Date().getFullYear();
    return this.narrative.getNarrative(companyId, y, force === '1');
  }
}

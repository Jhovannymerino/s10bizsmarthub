import { Module } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { KpiController } from './kpi.controller';
import { DirectorioPptxService } from './directorio-pptx.service';
import { S10Module } from '../s10/s10.module';

@Module({
  imports: [S10Module],
  providers: [KpiService, DirectorioPptxService],
  controllers: [KpiController],
  exports: [KpiService],
})
export class KpiModule {}

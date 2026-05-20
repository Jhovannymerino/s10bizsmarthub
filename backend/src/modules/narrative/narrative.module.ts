import { Module } from '@nestjs/common';
import { NarrativeService } from './narrative.service';
import { NarrativeController } from './narrative.controller';
import { KpiModule } from '../kpi/kpi.module';

@Module({
  imports: [KpiModule],
  controllers: [NarrativeController],
  providers: [NarrativeService],
})
export class NarrativeModule {}

import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { KpiModule } from '../kpi/kpi.module';
import { S10Module } from '../s10/s10.module';

@Module({
  imports: [KpiModule, S10Module],
  providers: [SyncService],
  controllers: [SyncController],
})
export class SyncModule {}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './modules/prisma/prisma.module';
import { S10Module } from './modules/s10/s10.module';
import { KpiModule } from './modules/kpi/kpi.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { SyncModule } from './modules/sync/sync.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { UsersModule } from './modules/users/users.module';
import { NarrativeModule } from './modules/narrative/narrative.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Rate-limit global de fuerza bruta (regla #62 global, patron canonico de Factum). Los
    // endpoints sensibles de auth.controller.ts llevan @Throttle mas estricto.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    S10Module,
    KpiModule,
    LedgerModule,
    SyncModule,
    AuthModule,
    CompanyModule,
    UsersModule,
    NarrativeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

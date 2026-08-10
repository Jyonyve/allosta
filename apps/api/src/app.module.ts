import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard, RolesGuard } from './common/auth.js';
import { MasterDataModule } from './master-data/master-data.module.js';
import { DelegationsModule } from './delegations/delegations.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { ConsultationsModule } from './consultations/consultations.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { BatchModule } from './batch/batch.module.js';
import { OperatorModule } from './operator/operator.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MasterDataModule,
    DelegationsModule,
    AvailabilityModule,
    ConsultationsModule,
    DashboardModule,
    BatchModule,
    OperatorModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

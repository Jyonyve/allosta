import { Controller, Injectable, Module, Post } from '@nestjs/common';
import { Cron, ScheduleModule } from '@nestjs/schedule';
import { Roles } from '../common/auth.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NoShowService {
  constructor(private readonly prisma: PrismaService) {}
  @Cron('0 10 0 * * *', { timeZone: 'Asia/Seoul' })
  async markOverdue(now = new Date()) {
    // RESERVED can never carry a record: saving the first draft moves a
    // consultation to DOCUMENTING (see ConsultationsModule#writeRecord), so
    // every overdue RESERVED consultation is undocumented by construction.
    // Attendance can only be confirmed as NO_SHOW once a CTI integration
    // reports it explicitly; this batch only settles the undocumented case.
    const { count } = await this.prisma.consultation.updateMany({
      where: { status: 'RESERVED', scheduledEndAt: { lte: now } },
      data: { status: 'NOT_ATTENDED' },
    });
    return { count };
  }
}
@Controller('operator/batch')
@Roles(UserRole.OPERATOR)
class BatchController {
  constructor(private readonly noShow: NoShowService) {}
  @Post('no-shows') run() {
    return this.noShow.markOverdue();
  }
}
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BatchController],
  providers: [NoShowService],
  exports: [NoShowService],
})
export class BatchModule {}

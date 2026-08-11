import { Controller, Injectable, Module, Post } from '@nestjs/common';
import { Cron, ScheduleModule } from '@nestjs/schedule';
import { Roles } from '../common/auth.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NoShowService {
  constructor(private readonly prisma: PrismaService) {}
  @Cron('0 10 0 * * *', { timeZone: 'Asia/Seoul' })
  async markPreviousDay(now = new Date()) {
    const kst = new Date(now.getTime() + 9 * 3600000),
      y = kst.getUTCFullYear(),
      m = kst.getUTCMonth(),
      d = kst.getUTCDate();
    const end = new Date(Date.UTC(y, m, d) - 9 * 3600000),
      start = new Date(end.getTime() - 86400000);
    return this.prisma.consultation.updateMany({
      where: { status: 'RESERVED', scheduledStartAt: { gte: start, lt: end } },
      data: { status: 'NO_SHOW', noShowAt: now },
    });
  }
}
@Controller('operator/batch')
@Roles(UserRole.OPERATOR)
class BatchController {
  constructor(private readonly noShow: NoShowService) {}
  @Post('no-shows') run() {
    return this.noShow.markPreviousDay();
  }
}
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [BatchController],
  providers: [NoShowService],
  exports: [NoShowService],
})
export class BatchModule {}

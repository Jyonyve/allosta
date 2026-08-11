import {
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { Roles } from '../common/auth.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('operator/consultations')
@Roles(UserRole.OPERATOR)
class OperatorController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() all() {
    return this.prisma.consultation.findMany({
      include: {
        requester: { select: { id: true, name: true, email: true } },
        advisor: { include: { user: { select: { name: true, email: true } } } },
        testResult: { include: { testType: true, examinee: true } },
        delegation: true,
        record: {
          include: { interestedProducts: { include: { product: true } } },
        },
      },
      orderBy: { scheduledStartAt: 'desc' },
    });
  }
  @Get(':id') async detail(@Param('id') id: string) {
    const item = await this.prisma.consultation.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        advisor: { include: { user: { select: { name: true, email: true } } } },
        testResult: {
          include: {
            testType: { include: { category: true } },
            examinee: true,
          },
        },
        delegation: true,
        record: {
          include: { interestedProducts: { include: { product: true } } },
        },
      },
    });
    if (!item) throw new NotFoundException('Consultation not found');
    return item;
  }
}
@Module({ controllers: [OperatorController] })
export class OperatorModule {}

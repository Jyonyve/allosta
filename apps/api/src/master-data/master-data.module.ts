import {
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../common/auth.js';
import type { AuthUser } from '../common/auth.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}
  products() {
    return this.prisma.product.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }
  async testResults(userId: string) {
    return this.prisma.testResult.findMany({
      where: {
        OR: [
          { examinee: { userId } },
          {
            delegations: {
              some: {
                delegateUserId: userId,
                status: 'APPROVED',
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
            },
          },
        ],
      },
      include: {
        testType: { include: { category: true } },
        examinee: { select: { id: true, name: true, userId: true } },
      },
      orderBy: { testedAt: 'desc' },
    });
  }
  async testResult(userId: string, id: string) {
    const item = (await this.testResults(userId)).find(
      (result) => result.id === id,
    );
    if (!item) throw new NotFoundException('Test result not found');
    return item;
  }
}

@Controller()
class MasterDataController {
  constructor(private readonly data: MasterDataService) {}
  @Roles(UserRole.CUSTOMER) @Get('test-results') testResults(
    @CurrentUser() user: AuthUser,
  ) {
    return this.data.testResults(user.id);
  }
  @Roles(UserRole.CUSTOMER) @Get('test-results/:id') testResult(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.data.testResult(user.id, id);
  }
  @Get('products') products() {
    return this.data.products();
  }
}

@Module({
  controllers: [MasterDataController],
  providers: [MasterDataService],
  exports: [MasterDataService],
})
export class MasterDataModule {}

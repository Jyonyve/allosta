import { Controller, Get, Module } from '@nestjs/common';
import {
  CqrsModule,
  IQueryHandler,
  QueryBus,
  QueryHandler,
} from '@nestjs/cqrs';
import { Roles } from '../common/auth.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

class DashboardQuery {}
@QueryHandler(DashboardQuery)
class DashboardHandler implements IQueryHandler<DashboardQuery> {
  constructor(private readonly prisma: PrismaService) {}
  async execute() {
    const [statusGroups, advisorGroups, productGroups, advisors] =
      await Promise.all([
        this.prisma.consultation.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.consultation.groupBy({
          by: ['advisorId', 'status'],
          _count: { _all: true },
        }),
        this.prisma.consultationInterestedProduct.groupBy({
          by: ['productId'],
          _count: { _all: true },
          orderBy: { _count: { productId: 'desc' } },
        }),
        this.prisma.advisorProfile.findMany({
          include: { user: { select: { name: true, email: true } } },
        }),
      ]);
    const statuses = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count._all]),
    );
    // Settled = consultations with a final outcome. CANCELLED is a normal,
    // in-policy customer action rather than a failed consultation, and
    // RESERVED/DOCUMENTING have no outcome yet, so both are excluded.
    const settled =
      (statuses.COMPLETED ?? 0) +
      (statuses.NOT_ATTENDED ?? 0) +
      (statuses.NO_SHOW ?? 0);
    const advisorStatistics = advisors.map((advisor) => {
      const rows = advisorGroups.filter((g) => g.advisorId === advisor.id),
        counts = Object.fromEntries(rows.map((g) => [g.status, g._count._all]));
      const advisorSettled =
        (counts.COMPLETED ?? 0) +
        (counts.NOT_ATTENDED ?? 0) +
        (counts.NO_SHOW ?? 0);
      return {
        advisorId: advisor.id,
        name: advisor.user.name,
        active: advisor.active,
        counts,
        completionRate: advisorSettled
          ? (counts.COMPLETED ?? 0) / advisorSettled
          : null,
        nonAttendanceRate: advisorSettled
          ? ((counts.NOT_ATTENDED ?? 0) + (counts.NO_SHOW ?? 0)) / advisorSettled
          : null,
      };
    });
    const products = productGroups.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productGroups.map((p) => p.productId) } },
        })
      : [];
    return {
      counts: statuses,
      completionRate: settled ? (statuses.COMPLETED ?? 0) / settled : null,
      nonAttendanceRate: settled
        ? ((statuses.NOT_ATTENDED ?? 0) + (statuses.NO_SHOW ?? 0)) / settled
        : null,
      advisorStatistics,
      interestedProducts: productGroups.map((g) => ({
        product: products.find((p) => p.id === g.productId),
        count: g._count._all,
      })),
    };
  }
}

@Controller('operator/dashboard')
@Roles(UserRole.OPERATOR)
class DashboardController {
  constructor(private readonly bus: QueryBus) {}
  @Get() get() {
    return this.bus.execute(new DashboardQuery());
  }
}

@Module({
  imports: [CqrsModule],
  controllers: [DashboardController],
  providers: [DashboardHandler],
})
export class DashboardModule {}

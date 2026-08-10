import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CommandBus,
  CommandHandler,
  CqrsModule,
  ICommandHandler,
  IQueryHandler,
  QueryBus,
  QueryHandler,
} from '@nestjs/cqrs';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { CurrentUser, Roles } from '../common/auth.js';
import type { AuthUser } from '../common/auth.js';
import { rethrowConstraint } from '../common/errors.js';
import { ConsultationStatus, UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { cancellationAllowed } from '../common/scheduling.rules.js';

const ACTIVE: ConsultationStatus[] = [
  ConsultationStatus.RESERVED,
  ConsultationStatus.DOCUMENTING,
];
class ReserveDto {
  @IsUUID() testResultId!: string;
  @IsDateString() scheduledStartAt!: string;
}
class CancelDto {
  @IsOptional() @IsString() reason?: string;
}
class RecordDto {
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsString() mainQuestion?: string;
  @IsOptional() @IsString() memo?: string;
  @IsOptional() @IsBoolean() followUpRequired?: boolean;
  @IsOptional() @IsString() followUpNote?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) productIds?: string[];
}
class AvailableSlotsQuery {
  constructor(
    public readonly userId: string,
    public readonly testResultId: string,
    public readonly from?: string,
  ) {}
}
class ReserveConsultation {
  constructor(
    public readonly userId: string,
    public readonly dto: ReserveDto,
  ) {}
}
class CancelConsultation {
  constructor(
    public readonly user: AuthUser,
    public readonly id: string,
    public readonly reason?: string,
  ) {}
}
class SaveDraft {
  constructor(
    public readonly advisorUserId: string,
    public readonly consultationId: string,
    public readonly dto: RecordDto,
  ) {}
}
class FinalizeRecord {
  constructor(
    public readonly advisorUserId: string,
    public readonly consultationId: string,
    public readonly dto: RecordDto,
  ) {}
}

function kstDayBounds(date: Date) {
  const shifted = new Date(date.getTime() + 9 * 3600000);
  const y = shifted.getUTCFullYear(),
    m = shifted.getUTCMonth(),
    d = shifted.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, d) - 9 * 3600000),
    end: new Date(Date.UTC(y, m, d + 1) - 9 * 3600000),
  };
}
async function policy(prisma: PrismaService) {
  const value = await prisma.schedulingPolicy.findFirst({
    where: { active: true },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (!value) throw new ConflictException('No active scheduling policy');
  return value;
}
async function access(
  prisma: PrismaService,
  userId: string,
  testResultId: string,
) {
  const result = await prisma.testResult.findUnique({
    where: { id: testResultId },
    include: { examinee: true },
  });
  if (!result) throw new NotFoundException('Test result not found');
  if (result.examinee.userId === userId)
    return { result, delegationId: undefined };
  const delegation = await prisma.consultationDelegation.findFirst({
    where: {
      testResultId,
      delegateUserId: userId,
      status: 'APPROVED',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (!delegation)
    throw new ForbiddenException(
      'Approved consent for this test result is required',
    );
  return { result, delegationId: delegation.id };
}
function validateWindow(
  start: Date,
  now: Date,
  p: {
    minimumBookingLeadTimeMinutes: number;
    bookingWindowDays: number;
    slotIntervalMinutes: number;
  },
) {
  if (start.getTime() < now.getTime() + p.minimumBookingLeadTimeMinutes * 60000)
    throw new BadRequestException('Minimum booking lead time is not met');
  if (start.getTime() > now.getTime() + p.bookingWindowDays * 86400000)
    throw new BadRequestException(
      'Requested time is outside the booking window',
    );
  if (
    start.getUTCMinutes() % p.slotIntervalMinutes !== 0 ||
    start.getUTCSeconds() !== 0 ||
    start.getUTCMilliseconds() !== 0
  )
    throw new BadRequestException(
      'Requested time is not aligned to the slot interval',
    );
}

@QueryHandler(AvailableSlotsQuery)
class AvailableSlotsHandler implements IQueryHandler<AvailableSlotsQuery> {
  constructor(private readonly prisma: PrismaService) {}
  async execute({ userId, testResultId, from }: AvailableSlotsQuery) {
    const { result } = await access(this.prisma, userId, testResultId);
    const p = await policy(this.prisma),
      now = new Date(),
      lower = new Date(
        Math.max(
          now.getTime() + p.minimumBookingLeadTimeMinutes * 60000,
          from ? new Date(from).getTime() : 0,
        ),
      );
    const upper = new Date(now.getTime() + p.bookingWindowDays * 86400000);
    const advisors = await this.prisma.advisorProfile.findMany({
      where: {
        active: true,
        testTypes: { some: { testTypeId: result.testTypeId } },
        availabilities: {
          some: { endsAt: { gt: lower }, startsAt: { lt: upper } },
        },
      },
      include: {
        availabilities: {
          where: { endsAt: { gt: lower }, startsAt: { lt: upper } },
        },
        consultations: {
          where: {
            status: { in: ACTIVE },
            scheduledEndAt: { gt: lower },
            scheduledStartAt: { lt: upper },
          },
          select: { scheduledStartAt: true, scheduledEndAt: true },
        },
      },
    });
    const slots = new Set<number>(),
      duration = p.consultationDurationMinutes * 60000,
      interval = p.slotIntervalMinutes * 60000;
    for (const advisor of advisors)
      for (const range of advisor.availabilities) {
        let cursor = Math.max(range.startsAt.getTime(), lower.getTime());
        cursor = Math.ceil(cursor / interval) * interval;
        while (
          cursor + duration <=
          Math.min(range.endsAt.getTime(), upper.getTime())
        ) {
          if (
            !advisor.consultations.some(
              (c) =>
                c.scheduledStartAt.getTime() < cursor + duration &&
                c.scheduledEndAt.getTime() > cursor,
            )
          )
            slots.add(cursor);
          cursor += interval;
        }
      }
    return [...slots]
      .sort((a, b) => a - b)
      .map((value) => new Date(value).toISOString());
  }
}

@CommandHandler(ReserveConsultation)
class ReserveConsultationHandler implements ICommandHandler<ReserveConsultation> {
  constructor(private readonly prisma: PrismaService) {}
  async execute({ userId, dto }: ReserveConsultation) {
    const start = new Date(dto.scheduledStartAt),
      p = await policy(this.prisma);
    validateWindow(start, new Date(), p);
    const { result, delegationId } = await access(
      this.prisma,
      userId,
      dto.testResultId,
    );
    const end = new Date(
        start.getTime() + p.consultationDurationMinutes * 60000,
      ),
      day = kstDayBounds(start);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const candidates = await tx.advisorProfile.findMany({
            where: {
              active: true,
              testTypes: { some: { testTypeId: result.testTypeId } },
              availabilities: {
                some: { startsAt: { lte: start }, endsAt: { gte: end } },
              },
              consultations: {
                none: {
                  status: { in: ACTIVE },
                  scheduledStartAt: { lt: end },
                  scheduledEndAt: { gt: start },
                },
              },
            },
            select: { id: true },
          });
          if (!candidates.length)
            throw new ConflictException(
              'No advisor is available for this time',
            );
          const counts = await tx.consultation.groupBy({
            by: ['advisorId'],
            where: {
              advisorId: { in: candidates.map((a) => a.id) },
              scheduledStartAt: { gte: day.start, lt: day.end },
              status: { in: ACTIVE },
            },
            _count: { _all: true },
          });
          const byId = new Map(counts.map((c) => [c.advisorId, c._count._all]));
          candidates.sort(
            (a, b) =>
              (byId.get(a.id) ?? 0) - (byId.get(b.id) ?? 0) ||
              a.id.localeCompare(b.id),
          );
          return tx.consultation.create({
            data: {
              requesterUserId: userId,
              testResultId: result.id,
              advisorId: candidates[0].id,
              delegationId,
              scheduledStartAt: start,
              scheduledEndAt: end,
            },
            include: {
              advisor: {
                include: { user: { select: { id: true, name: true } } },
              },
              testResult: {
                include: {
                  testType: true,
                  examinee: { select: { id: true, name: true } },
                },
              },
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      rethrowConstraint(
        error,
        'The time or test result was booked concurrently',
      );
    }
  }
}

@CommandHandler(CancelConsultation)
class CancelConsultationHandler implements ICommandHandler<CancelConsultation> {
  constructor(private readonly prisma: PrismaService) {}
  async execute({ user, id, reason }: CancelConsultation) {
    const item = await this.prisma.consultation.findUnique({
      where: { id },
      include: { advisor: true },
    });
    if (!item) throw new NotFoundException('Consultation not found');
    if (user.role === UserRole.CUSTOMER && item.requesterUserId !== user.id)
      throw new ForbiddenException();
    if (user.role === UserRole.ADVISOR && item.advisor.userId !== user.id)
      throw new ForbiddenException();
    if (item.status !== ConsultationStatus.RESERVED)
      throw new ConflictException(
        'Only reserved consultations can be cancelled',
      );
    const p = await policy(this.prisma);
    if (
      !cancellationAllowed(
        new Date(),
        item.scheduledStartAt,
        p.cancellationCutoffMinutes,
      )
    )
      throw new ConflictException('Cancellation cutoff has passed');
    return this.prisma.consultation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledByUserId: user.id,
        cancellationReason: reason,
      },
    });
  }
}

async function ownedAdvisorConsultation(
  prisma: PrismaService,
  userId: string,
  id: string,
) {
  const item = await prisma.consultation.findFirst({
    where: { id, advisor: { userId } },
    include: { record: true },
  });
  if (!item) throw new NotFoundException('Assigned consultation not found');
  return item;
}
export async function writeRecord(
  prisma: PrismaService,
  advisorUserId: string,
  consultationId: string,
  dto: RecordDto,
  finalize: boolean,
) {
  const consultation = await ownedAdvisorConsultation(
    prisma,
    advisorUserId,
    consultationId,
  );
  if (consultation.record?.status === 'FINAL')
    throw new ConflictException('Final records are immutable');
  if (
    consultation.status !== 'RESERVED' &&
    consultation.status !== 'DOCUMENTING'
  )
    throw new ConflictException(
      'Consultation cannot be documented in its current state',
    );
  const productIds = [...new Set(dto.productIds ?? [])];
  if (productIds.length) {
    const count = await prisma.product.count({
      where: { id: { in: productIds }, active: true },
    });
    if (count !== productIds.length)
      throw new BadRequestException(
        'One or more products are invalid or inactive',
      );
  }
  return prisma.$transaction(async (tx) => {
    const record = await tx.consultationRecord.upsert({
      where: { consultationId },
      create: {
        consultationId,
        summary: dto.summary,
        mainQuestion: dto.mainQuestion,
        memo: dto.memo,
        followUpRequired: dto.followUpRequired ?? false,
        followUpNote: dto.followUpNote,
      },
      update: {
        summary: dto.summary,
        mainQuestion: dto.mainQuestion,
        memo: dto.memo,
        followUpRequired: dto.followUpRequired,
        followUpNote: dto.followUpNote,
      },
    });
    await tx.consultationInterestedProduct.deleteMany({
      where: { consultationRecordId: record.id },
    });
    if (productIds.length)
      await tx.consultationInterestedProduct.createMany({
        data: productIds.map((productId) => ({
          consultationRecordId: record.id,
          productId,
        })),
      });
    if (!finalize) {
      if (consultation.status === 'RESERVED')
        await tx.consultation.update({
          where: { id: consultationId },
          data: { status: 'DOCUMENTING' },
        });
      return tx.consultationRecord.findUnique({
        where: { id: record.id },
        include: { interestedProducts: { include: { product: true } } },
      });
    }
    const finalizedAt = new Date();
    const finalRecord = await tx.consultationRecord.update({
      where: { id: record.id },
      data: { status: 'FINAL', finalizedAt },
      include: { interestedProducts: { include: { product: true } } },
    });
    await tx.consultation.update({
      where: { id: consultationId },
      data: { status: 'COMPLETED', completedAt: finalizedAt },
    });
    return finalRecord;
  });
}
@CommandHandler(SaveDraft)
class SaveDraftHandler implements ICommandHandler<SaveDraft> {
  constructor(private readonly prisma: PrismaService) {}
  execute(c: SaveDraft) {
    return writeRecord(
      this.prisma,
      c.advisorUserId,
      c.consultationId,
      c.dto,
      false,
    );
  }
}
@CommandHandler(FinalizeRecord)
class FinalizeRecordHandler implements ICommandHandler<FinalizeRecord> {
  constructor(private readonly prisma: PrismaService) {}
  execute(c: FinalizeRecord) {
    return writeRecord(
      this.prisma,
      c.advisorUserId,
      c.consultationId,
      c.dto,
      true,
    );
  }
}

@Controller('consultations')
class ConsultationsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly prisma: PrismaService,
  ) {}
  @Roles(UserRole.CUSTOMER) @Get('available-slots') slots(
    @CurrentUser() user: AuthUser,
    @Query('testResultId') id: string,
    @Query('from') from?: string,
  ) {
    return this.queries.execute(new AvailableSlotsQuery(user.id, id, from));
  }
  @Roles(UserRole.CUSTOMER) @Post() reserve(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReserveDto,
  ) {
    return this.commands.execute(new ReserveConsultation(user.id, dto));
  }
  @Roles(UserRole.CUSTOMER) @Get('mine') mine(@CurrentUser() user: AuthUser) {
    return this.prisma.consultation.findMany({
      where: { requesterUserId: user.id },
      include: {
        advisor: { include: { user: { select: { name: true } } } },
        testResult: {
          include: { testType: true, examinee: { select: { name: true } } },
        },
        record: true,
      },
      orderBy: { scheduledStartAt: 'desc' },
    });
  }
  @Roles(UserRole.CUSTOMER, UserRole.ADVISOR, UserRole.OPERATOR)
  @Patch(':id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelDto,
  ) {
    return this.commands.execute(new CancelConsultation(user, id, dto.reason));
  }
  @Roles(UserRole.ADVISOR) @Get('advisor/mine') async advisorMine(
    @CurrentUser() user: AuthUser,
  ) {
    return this.prisma.consultation.findMany({
      where: { advisor: { userId: user.id } },
      include: {
        requester: { select: { id: true, name: true } },
        testResult: { include: { testType: true, examinee: true } },
        record: {
          include: { interestedProducts: { include: { product: true } } },
        },
      },
      orderBy: { scheduledStartAt: 'desc' },
    });
  }
  @Roles(UserRole.ADVISOR) @Patch(':id/record') draft(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RecordDto,
  ) {
    return this.commands.execute(new SaveDraft(user.id, id, dto));
  }
  @Roles(UserRole.ADVISOR) @Post(':id/record/finalize') finalize(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RecordDto,
  ) {
    return this.commands.execute(new FinalizeRecord(user.id, id, dto));
  }
}

@Module({
  imports: [CqrsModule],
  controllers: [ConsultationsController],
  providers: [
    AvailableSlotsHandler,
    ReserveConsultationHandler,
    CancelConsultationHandler,
    SaveDraftHandler,
    FinalizeRecordHandler,
  ],
})
export class ConsultationsModule {}

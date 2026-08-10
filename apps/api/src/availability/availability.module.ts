import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CommandBus,
  CommandHandler,
  CqrsModule,
  ICommandHandler,
} from '@nestjs/cqrs';
import { IsDateString } from 'class-validator';
import { CurrentUser, Roles } from '../common/auth.js';
import type { AuthUser } from '../common/auth.js';
import { rethrowConstraint } from '../common/errors.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

class AvailabilityDto {
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
}
class SaveAvailability {
  constructor(
    public readonly userId: string,
    public readonly dto: AvailabilityDto,
    public readonly id?: string,
  ) {}
}
class DeleteAvailability {
  constructor(
    public readonly userId: string,
    public readonly id: string,
  ) {}
}

async function advisorFor(prisma: PrismaService, userId: string) {
  const advisor = await prisma.advisorProfile.findUnique({ where: { userId } });
  if (!advisor) throw new NotFoundException('Advisor profile not found');
  return advisor;
}

@CommandHandler(SaveAvailability)
class SaveAvailabilityHandler implements ICommandHandler<SaveAvailability> {
  constructor(private readonly prisma: PrismaService) {}
  async execute({ userId, dto, id }: SaveAvailability) {
    const advisor = await advisorFor(this.prisma, userId);
    const startsAt = new Date(dto.startsAt),
      endsAt = new Date(dto.endsAt);
    if (!(startsAt < endsAt))
      throw new BadRequestException('startsAt must be before endsAt');
    const overlap = await this.prisma.advisorAvailability.findFirst({
      where: {
        advisorId: advisor.id,
        id: id ? { not: id } : undefined,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (overlap)
      throw new ConflictException('Availability ranges cannot overlap');
    if (id) {
      const owned = await this.prisma.advisorAvailability.findFirst({
        where: { id, advisorId: advisor.id },
      });
      if (!owned) throw new NotFoundException('Availability not found');
      const invalidated = await this.prisma.consultation.findFirst({
        where: {
          advisorId: advisor.id,
          status: { in: ['RESERVED', 'DOCUMENTING'] },
          OR: [
            { scheduledStartAt: { lt: startsAt } },
            { scheduledEndAt: { gt: endsAt } },
          ],
          scheduledStartAt: { lt: owned.endsAt },
          scheduledEndAt: { gt: owned.startsAt },
        },
      });
      if (invalidated)
        throw new ConflictException(
          'Availability change would invalidate an active consultation',
        );
    }
    try {
      return id
        ? await this.prisma.advisorAvailability.update({
            where: { id },
            data: { startsAt, endsAt },
          })
        : await this.prisma.advisorAvailability.create({
            data: { advisorId: advisor.id, startsAt, endsAt },
          });
    } catch (error) {
      rethrowConstraint(error, 'Availability overlaps another range');
    }
  }
}

@CommandHandler(DeleteAvailability)
class DeleteAvailabilityHandler implements ICommandHandler<DeleteAvailability> {
  constructor(private readonly prisma: PrismaService) {}
  async execute({ userId, id }: DeleteAvailability) {
    const advisor = await advisorFor(this.prisma, userId);
    const availability = await this.prisma.advisorAvailability.findFirst({
      where: { id, advisorId: advisor.id },
    });
    if (!availability) throw new NotFoundException('Availability not found');
    const consultation = await this.prisma.consultation.findFirst({
      where: {
        advisorId: advisor.id,
        status: { in: ['RESERVED', 'DOCUMENTING'] },
        scheduledStartAt: { gte: availability.startsAt },
        scheduledEndAt: { lte: availability.endsAt },
      },
    });
    if (consultation)
      throw new ConflictException(
        'Availability contains an active consultation',
      );
    return this.prisma.advisorAvailability.delete({ where: { id } });
  }
}

@Controller('advisor')
@Roles(UserRole.ADVISOR)
class AvailabilityController {
  constructor(
    private readonly bus: CommandBus,
    private readonly prisma: PrismaService,
  ) {}
  @Get('profile') async profile(@CurrentUser() user: AuthUser) {
    return this.prisma.advisorProfile.findUnique({
      where: { userId: user.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        testTypes: { include: { testType: true } },
      },
    });
  }
  @Get('availability') async list(@CurrentUser() user: AuthUser) {
    const advisor = await advisorFor(this.prisma, user.id);
    return this.prisma.advisorAvailability.findMany({
      where: { advisorId: advisor.id },
      orderBy: { startsAt: 'asc' },
    });
  }
  @Post('availability') create(
    @CurrentUser() user: AuthUser,
    @Body() dto: AvailabilityDto,
  ) {
    return this.bus.execute(new SaveAvailability(user.id, dto));
  }
  @Patch('availability/:id') update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AvailabilityDto,
  ) {
    return this.bus.execute(new SaveAvailability(user.id, dto, id));
  }
  @Delete('availability/:id') remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.bus.execute(new DeleteAvailability(user.id, id));
  }
}

@Module({
  imports: [CqrsModule],
  controllers: [AvailabilityController],
  providers: [SaveAvailabilityHandler, DeleteAvailabilityHandler],
})
export class AvailabilityModule {}

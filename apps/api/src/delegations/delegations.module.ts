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
} from '@nestjs/common';
import {
  CommandBus,
  CommandHandler,
  CqrsModule,
  ICommandHandler,
} from '@nestjs/cqrs';
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';
import { CurrentUser, Roles } from '../common/auth.js';
import type { AuthUser } from '../common/auth.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

class RequestDelegationDto {
  @IsUUID() testResultId!: string;
  @IsEmail() delegateEmail!: string;
}
class VerifyDelegationDto {
  @IsOptional() @IsString() note?: string;
}
class RequestDelegation {
  constructor(
    public readonly ownerId: string,
    public readonly dto: RequestDelegationDto,
  ) {}
}
class DecideDelegation {
  constructor(
    public readonly ownerId: string,
    public readonly id: string,
    public readonly approve: boolean,
  ) {}
}
class VerifyDelegation {
  constructor(
    public readonly operatorId: string,
    public readonly id: string,
  ) {}
}

@CommandHandler(RequestDelegation)
class RequestDelegationHandler implements ICommandHandler<RequestDelegation> {
  constructor(private readonly prisma: PrismaService) {}
  async execute({ ownerId, dto }: RequestDelegation) {
    const result = await this.prisma.testResult.findFirst({
      where: { id: dto.testResultId, examinee: { userId: ownerId } },
    });
    if (!result) throw new NotFoundException('Owned test result not found');
    const delegate = await this.prisma.user.findUnique({
      where: { email: dto.delegateEmail.toLowerCase() },
    });
    if (!delegate || delegate.role !== UserRole.CUSTOMER)
      throw new NotFoundException('Delegate customer not found');
    if (delegate.id === ownerId)
      throw new BadRequestException('Self-delegation is not allowed');
    const existing = await this.prisma.consultationDelegation.findFirst({
      where: {
        testResultId: result.id,
        delegateUserId: delegate.id,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });
    if (existing)
      throw new ConflictException('An active delegation already exists');
    return this.prisma.consultationDelegation.create({
      data: { testResultId: result.id, delegateUserId: delegate.id },
    });
  }
}

@CommandHandler(DecideDelegation)
class DecideDelegationHandler implements ICommandHandler<DecideDelegation> {
  constructor(private readonly prisma: PrismaService) {}
  async execute({ ownerId, id, approve }: DecideDelegation) {
    const item = await this.prisma.consultationDelegation.findFirst({
      where: {
        id,
        status: 'PENDING',
        testResult: { examinee: { userId: ownerId } },
      },
    });
    if (!item) throw new NotFoundException('Pending delegation not found');
    return this.prisma.consultationDelegation.update({
      where: { id },
      data: approve
        ? {
            status: 'APPROVED',
            consentMethod: 'SELF_SERVICE',
            consentedByUserId: ownerId,
            consentedAt: new Date(),
          }
        : {
            status: 'REJECTED',
            consentedByUserId: ownerId,
            consentedAt: new Date(),
          },
    });
  }
}

@CommandHandler(VerifyDelegation)
class VerifyDelegationHandler implements ICommandHandler<VerifyDelegation> {
  constructor(private readonly prisma: PrismaService) {}
  async execute({ operatorId, id }: VerifyDelegation) {
    const item = await this.prisma.consultationDelegation.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('Delegation not found');
    if (item.status !== 'PENDING')
      throw new ConflictException('Only pending delegation can be verified');
    return this.prisma.consultationDelegation.update({
      where: { id },
      data: {
        status: 'APPROVED',
        consentMethod: 'EXTERNAL_VERIFIED',
        verifiedByOperatorUserId: operatorId,
        consentedAt: new Date(),
      },
    });
  }
}

@Controller('delegations')
class DelegationsController {
  constructor(
    private readonly bus: CommandBus,
    private readonly prisma: PrismaService,
  ) {}
  @Roles(UserRole.CUSTOMER) @Post() request(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestDelegationDto,
  ) {
    return this.bus.execute(new RequestDelegation(user.id, dto));
  }
  @Roles(UserRole.CUSTOMER) @Get('pending-consent') pending(
    @CurrentUser() user: AuthUser,
  ) {
    return this.prisma.consultationDelegation.findMany({
      where: {
        status: 'PENDING',
        testResult: { examinee: { userId: user.id } },
      },
      include: {
        delegate: { select: { id: true, name: true, email: true } },
        testResult: { include: { testType: true } },
      },
    });
  }
  @Roles(UserRole.CUSTOMER) @Patch(':id/approve') approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.bus.execute(new DecideDelegation(user.id, id, true));
  }
  @Roles(UserRole.CUSTOMER) @Patch(':id/reject') reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.bus.execute(new DecideDelegation(user.id, id, false));
  }
  @Roles(UserRole.OPERATOR) @Patch(':id/external-verify') verify(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() _dto: VerifyDelegationDto,
  ) {
    return this.bus.execute(new VerifyDelegation(user.id, id));
  }
}

@Module({
  imports: [CqrsModule],
  controllers: [DelegationsController],
  providers: [
    RequestDelegationHandler,
    DecideDelegationHandler,
    VerifyDelegationHandler,
  ],
})
export class DelegationsModule {}

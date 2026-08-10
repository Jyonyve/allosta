import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../generated/prisma/enums.js';

export type AuthUser = { id: string; email: string; role: UserRole };
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}
  canActivate(ctx: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        ctx.getHandler(),
        ctx.getClass(),
      ])
    )
      return true;
    const request = ctx
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string }; user?: AuthUser }>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token)
      throw new UnauthorizedException('Bearer token required');
    try {
      request.user = this.jwt.verify<AuthUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user || !roles.includes(user.role))
      throw new ForbiddenException('Role not permitted');
    return true;
  }
}

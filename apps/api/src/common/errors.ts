import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

export function rethrowConstraint(
  error: unknown,
  message = 'The request conflicts with current scheduling data',
): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2002', 'P2003', 'P2011', 'P2014'].includes(error.code)
  ) {
    throw new ConflictException(message);
  }
  const code = (error as { code?: string })?.code;
  if (code === '23P01' || code === '23505' || code === '23514')
    throw new ConflictException(message);
  throw error;
}

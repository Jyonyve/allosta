import { NoShowService } from './batch.module.js';
import { jest } from '@jest/globals';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('previous-day no-show batch', () => {
  it('updates only previous-day RESERVED consultations', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = new NoShowService({
      consultation: { updateMany },
    } as unknown as PrismaService);
    const now = new Date('2026-08-10T15:10:00Z');
    await service.markPreviousDay(now);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: 'RESERVED',
        scheduledStartAt: {
          gte: new Date('2026-08-09T15:00:00Z'),
          lt: new Date('2026-08-10T15:00:00Z'),
        },
      },
      data: { status: 'NO_SHOW', noShowAt: now },
    });
  });
});

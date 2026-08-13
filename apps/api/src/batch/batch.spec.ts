import { NoShowService } from './batch.module.js';
import { jest } from '@jest/globals';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('previous-day attendance batch', () => {
  it('marks undocumented overdue reservations as NOT_ATTENDED', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'a', record: null },
      { id: 'b', record: null },
    ]);
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = new NoShowService({
      consultation: { findMany, updateMany },
    } as unknown as PrismaService);
    const now = new Date('2026-08-10T15:10:00Z');
    const result = await service.markPreviousDay(now);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: 'RESERVED',
        scheduledStartAt: {
          gte: new Date('2026-08-09T15:00:00Z'),
          lt: new Date('2026-08-10T15:00:00Z'),
        },
      },
      select: { id: true, record: { select: { id: true } } },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
      data: { status: 'NOT_ATTENDED' },
    });
    expect(result).toEqual({ count: 2, noShows: 0, notAttended: 2 });
  });

  it('marks overdue reservations that have a record as NO_SHOW', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ id: 'a', record: { id: 'r1' } }]);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new NoShowService({
      consultation: { findMany, updateMany },
    } as unknown as PrismaService);
    const now = new Date('2026-08-10T15:10:00Z');
    const result = await service.markPreviousDay(now);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a'] } },
      data: { status: 'NO_SHOW', noShowAt: now },
    });
    expect(result).toEqual({ count: 1, noShows: 1, notAttended: 0 });
  });
});

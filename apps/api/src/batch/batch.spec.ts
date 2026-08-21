import { NoShowService } from './batch.module.js';
import { jest } from '@jest/globals';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('overdue attendance batch', () => {
  it('marks overdue reserved consultations as NOT_ATTENDED', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = new NoShowService({
      consultation: { updateMany },
    } as unknown as PrismaService);
    const now = new Date('2026-08-10T15:10:00Z');
    const result = await service.markOverdue(now);

    expect(updateMany).toHaveBeenCalledWith({
      where: { status: 'RESERVED', scheduledEndAt: { lte: now } },
      data: { status: 'NOT_ATTENDED' },
    });
    expect(result).toEqual({ count: 2 });
  });
});

import { ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { writeRecord } from './consultations.module.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function prismaMock(record: { status: 'DRAFT' | 'FINAL' } | null = null) {
  const tx = {
    consultationRecord: {
      upsert: jest.fn().mockResolvedValue({ id: 'record-1' }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'record-1', status: 'DRAFT' }),
      update: jest.fn().mockResolvedValue({ id: 'record-1', status: 'FINAL' }),
    },
    consultationInterestedProduct: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    consultation: { update: jest.fn() },
  };
  const prisma = {
    consultation: {
      findFirst: jest
        .fn()
        .mockResolvedValue({
          id: 'consultation-1',
          status: 'RESERVED',
          record,
        }),
    },
    product: { count: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  return { prisma, tx };
}

describe('consultation record lifecycle', () => {
  it('creates a persisted DRAFT and moves RESERVED to DOCUMENTING', async () => {
    const { prisma, tx } = prismaMock();
    await writeRecord(
      prisma,
      'advisor-user',
      'consultation-1',
      { summary: 'Call occurred' },
      false,
    );
    expect(tx.consultationRecord.upsert).toHaveBeenCalled();
    expect(tx.consultation.update).toHaveBeenCalledWith({
      where: { id: 'consultation-1' },
      data: { status: 'DOCUMENTING' },
    });
  });

  it('writes FINAL and COMPLETED in the same transaction', async () => {
    const { prisma, tx } = prismaMock({ status: 'DRAFT' });
    await writeRecord(
      prisma,
      'advisor-user',
      'consultation-1',
      { summary: 'Final' },
      true,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.consultationRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FINAL' }),
      }),
    );
    expect(tx.consultation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('does not edit a FINAL record', async () => {
    const { prisma } = prismaMock({ status: 'FINAL' });
    await expect(
      writeRecord(
        prisma,
        'advisor-user',
        'consultation-1',
        { memo: 'edit' },
        false,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

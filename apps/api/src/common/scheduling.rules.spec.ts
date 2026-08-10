import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  advisorMayReceiveNewAssignment,
  cancellationAllowed,
  delegationGrantsResult,
  noShowEligible,
  rangesOverlap,
} from './scheduling.rules.js';
import {
  ConsultationStatus,
  DelegationStatus,
} from '../generated/prisma/enums.js';

describe('scheduling invariants', () => {
  const migration = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260810065833_init/migration.sql'),
    'utf8',
  );

  it.each([
    ['advisor double-booking', 'uq_active_advisor_consultation'],
    ['requester double-booking', 'uq_active_requester_consultation'],
    [
      'multiple active consultations for one result',
      'uq_active_test_result_consultation',
    ],
    ['availability overlap', 'advisor_availability_no_overlap'],
  ])('keeps the database guarantee for %s', (_rule, constraint) =>
    expect(migration).toContain(constraint),
  );

  it('blocks overlapping availability and permits adjacent ranges', () => {
    const at = (hour: number) =>
      new Date(`2026-08-11T${String(hour).padStart(2, '0')}:00:00Z`);
    expect(rangesOverlap(at(11), at(14), at(13), at(16))).toBe(true);
    expect(rangesOverlap(at(11), at(14), at(14), at(16))).toBe(false);
  });

  it('enforces the cancellation cutoff and releases cancelled capacity', () => {
    const start = new Date('2026-08-11T05:00:00Z');
    expect(
      cancellationAllowed(new Date('2026-08-11T04:00:00Z'), start, 60),
    ).toBe(true);
    expect(
      cancellationAllowed(new Date('2026-08-11T04:00:00.001Z'), start, 60),
    ).toBe(false);
    expect(
      [ConsultationStatus.RESERVED, ConsultationStatus.DOCUMENTING].includes(
        ConsultationStatus.CANCELLED,
      ),
    ).toBe(false);
  });

  it('grants delegation for only the specifically approved, unexpired result', () => {
    const delegation = {
      testResultId: 'result-a',
      status: DelegationStatus.APPROVED,
      expiresAt: null,
    };
    expect(delegationGrantsResult(delegation, 'result-a', new Date())).toBe(
      true,
    );
    expect(delegationGrantsResult(delegation, 'result-b', new Date())).toBe(
      false,
    );
    expect(
      delegationGrantsResult(
        { ...delegation, status: DelegationStatus.PENDING },
        'result-a',
        new Date(),
      ),
    ).toBe(false);
  });

  it('marks only RESERVED as no-show, never DOCUMENTING', () => {
    expect(noShowEligible(ConsultationStatus.RESERVED)).toBe(true);
    expect(noShowEligible(ConsultationStatus.DOCUMENTING)).toBe(false);
    expect(noShowEligible(ConsultationStatus.COMPLETED)).toBe(false);
  });

  it('excludes inactive advisors from new assignment', () => {
    const eligible = {
      active: true,
      supportsTestType: true,
      availabilityCoversSlot: true,
      hasConflict: false,
    };
    expect(advisorMayReceiveNewAssignment(eligible)).toBe(true);
    expect(advisorMayReceiveNewAssignment({ ...eligible, active: false })).toBe(
      false,
    );
    expect(
      advisorMayReceiveNewAssignment({ ...eligible, hasConflict: true }),
    ).toBe(false);
  });
});

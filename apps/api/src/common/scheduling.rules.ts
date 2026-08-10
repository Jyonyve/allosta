import {
  ConsultationStatus,
  DelegationStatus,
} from '../generated/prisma/enums.js';

export const activeConsultation = (status: ConsultationStatus) =>
  status === ConsultationStatus.RESERVED ||
  status === ConsultationStatus.DOCUMENTING;
export const rangesOverlap = (
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
) => aStart < bEnd && aEnd > bStart;
export const cancellationAllowed = (
  now: Date,
  startsAt: Date,
  cutoffMinutes: number,
) => now.getTime() <= startsAt.getTime() - cutoffMinutes * 60000;
export const noShowEligible = (status: ConsultationStatus) =>
  status === ConsultationStatus.RESERVED;
export const delegationGrantsResult = (
  delegation: {
    testResultId: string;
    status: DelegationStatus;
    expiresAt: Date | null;
  },
  testResultId: string,
  now: Date,
) =>
  delegation.testResultId === testResultId &&
  delegation.status === DelegationStatus.APPROVED &&
  (!delegation.expiresAt || delegation.expiresAt > now);
export const advisorMayReceiveNewAssignment = (advisor: {
  active: boolean;
  supportsTestType: boolean;
  availabilityCoversSlot: boolean;
  hasConflict: boolean;
}) =>
  advisor.active &&
  advisor.supportsTestType &&
  advisor.availabilityCoversSlot &&
  !advisor.hasConflict;

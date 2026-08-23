import { useEffect } from 'react';
import { ApiError } from './api';

/** Stable query keys. Tokens are never part of a key; user ids scope per-account data. */
export const queryKeys = {
  testResults: (userId: string) => ['test-results', userId] as const,
  myConsultations: (userId: string) => ['consultations', 'mine', userId] as const,
  availableSlots: (testResultId: string) => ['available-slots', testResultId] as const,
  advisorProfile: (advisorUserId: string) => ['advisor', 'profile', advisorUserId] as const,
  advisorAvailability: (advisorUserId: string) => ['advisor', 'availability', advisorUserId] as const,
  advisorConsultations: (advisorUserId: string) => ['advisor', 'consultations', advisorUserId] as const,
  products: () => ['products'] as const,
  operatorDashboard: () => ['operator', 'dashboard'] as const,
  operatorConsultations: () => ['operator', 'consultations'] as const,
  pendingConsentDelegations: () => ['delegations', 'pending-consent'] as const,
  pendingExternalDelegations: () => ['delegations', 'pending-external'] as const,
};

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

/** Returns the first error that is not a 401, so 401s stay reserved for the logout path. */
export function firstDisplayableError(...errors: unknown[]) {
  return errors.find((error) => error != null && !isUnauthorized(error)) ?? null;
}

/** Runs the existing unauthorized/logout handling when any observed query fails with a 401. */
export function useUnauthorizedHandler(errors: unknown[], onUnauthorized: () => void) {
  const unauthorized = errors.some(isUnauthorized);
  useEffect(() => {
    if (unauthorized) onUnauthorized();
  }, [unauthorized, onUnauthorized]);
}

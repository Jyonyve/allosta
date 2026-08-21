const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'ADVISOR' | 'OPERATOR';
};

export type Session = {
  accessToken: string;
  user: User;
};

export type TestResult = {
  id: string;
  testedAt: string;
  summary: string | null;
  testType: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    category: { id: string; code: string; name: string };
  };
  examinee: { id: string; name: string; userId: string | null };
};

export type ConsultationStatus =
  | 'RESERVED'
  | 'DOCUMENTING'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'NOT_ATTENDED'
  | 'CANCELLED';

export type Consultation = {
  id: string;
  status: ConsultationStatus;
  scheduledStartAt: string;
  scheduledEndAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  advisor: { user: { name: string } };
  testResult: {
    id: string;
    testType: { id: string; code: string; name: string };
    examinee: { name: string };
  };
  record: { id: string; status: 'DRAFT' | 'FINAL'; summary: string | null } | null;
};

export type AdvisorProfile = {
  id: string;
  introduction: string | null;
  active: boolean;
  user: { id: string; name: string; email: string };
  testTypes: Array<{
    testType: { id: string; code: string; name: string; description: string | null };
  }>;
};

export type AdvisorAvailability = {
  id: string;
  advisorId: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  active: boolean;
};

export type ConsultationRecord = {
  id: string;
  status: 'DRAFT' | 'FINAL';
  summary: string | null;
  mainQuestion: string | null;
  memo: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  finalizedAt: string | null;
  interestedProducts: Array<{ productId: string; product: Product }>;
};

export type AdvisorConsultation = Omit<Consultation, 'record'> & {
  requester: { id: string; name: string };
  testResult: Consultation['testResult'] & {
    testedAt: string;
    summary: string | null;
  };
  record: ConsultationRecord | null;
};

export type RecordInput = {
  summary?: string;
  mainQuestion?: string;
  memo?: string;
  followUpRequired?: boolean;
  followUpNote?: string;
  productIds?: string[];
};

export type OperatorConsultation = AdvisorConsultation & {
  requester: { id: string; name: string; email: string };
  advisor: { user: { name: string; email: string } };
  delegation: {
    id: string;
    status: string;
    consentMethod: 'SELF_SERVICE' | 'EXTERNAL_VERIFIED' | null;
  } | null;
};

export type Dashboard = {
  counts: Partial<Record<ConsultationStatus, number>>;
  completionRate: number | null;
  noShowRate: number | null;
  advisorStatistics: Array<{
    advisorId: string;
    name: string;
    active: boolean;
    counts: Partial<Record<ConsultationStatus, number>>;
    completionRate: number | null;
    noShowRate: number | null;
  }>;
  interestedProducts: Array<{ product: Product; count: number }>;
};

export type PendingDelegation = {
  id: string;
  status: 'PENDING';
  createdAt: string;
  delegate: { id: string; name: string; email: string };
  testResult: {
    id: string;
    testedAt: string;
    summary: string | null;
    examinee: { id: string; name: string };
    testType: { id: string; code: string; name: string };
  };
};

export type MyDelegation = {
  id: string;
  status: 'PENDING';
  createdAt: string;
  delegate: { id: string; name: string; email: string };
  testResult: {
    id: string;
    testedAt: string;
    summary: string | null;
    testType: { id: string; code: string; name: string };
  };
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, 'body' | 'signal'> & {
  token?: string;
  body?: unknown;
};

const REQUEST_TIMEOUT_MS = 90_000;

async function request<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(
      controller.signal.aborted
        ? 'The server took too long to respond. The free demo server may have been waking up—please try again.'
        : 'Network request failed. Check your connection and try again.',
      0,
    );
  } finally {
    clearTimeout(timer);
  }
  const payload = (await response.json().catch(() => null)) as { message?: string | string[] } | null;

  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : payload?.message || 'The request could not be completed.';
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export const api = {
  login(email: string, password: string) {
    return request<Session>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  },
  testResults(token: string) {
    return request<TestResult[]>('/test-results', { token });
  },
  testResult(token: string, id: string) {
    return request<TestResult>(`/test-results/${id}`, { token });
  },
  availableSlots(token: string, testResultId: string) {
    const query = new URLSearchParams({ testResultId });
    return request<string[]>(`/consultations/available-slots?${query}`, { token });
  },
  reserve(token: string, testResultId: string, scheduledStartAt: string, replaceExisting = false) {
    return request<Consultation>('/consultations', {
      method: 'POST',
      token,
      body: { testResultId, scheduledStartAt, replaceExisting },
    });
  },
  consultations(token: string) {
    return request<Consultation[]>('/consultations/mine', { token });
  },
  cancel(token: string, id: string) {
    return request<Consultation>(`/consultations/${id}/cancel`, {
      method: 'PATCH',
      token,
      body: { reason: 'Cancelled by customer' },
    });
  },
  advisorProfile(token: string) {
    return request<AdvisorProfile>('/advisor/profile', { token });
  },
  advisorAvailability(token: string) {
    return request<AdvisorAvailability[]>('/advisor/availability', { token });
  },
  createAvailability(token: string, startsAt: string, endsAt: string) {
    return request<AdvisorAvailability>('/advisor/availability', {
      method: 'POST',
      token,
      body: { startsAt, endsAt },
    });
  },
  updateAvailability(token: string, id: string, startsAt: string, endsAt: string) {
    return request<AdvisorAvailability>(`/advisor/availability/${id}`, {
      method: 'PATCH',
      token,
      body: { startsAt, endsAt },
    });
  },
  deleteAvailability(token: string, id: string) {
    return request<AdvisorAvailability>(`/advisor/availability/${id}`, {
      method: 'DELETE',
      token,
    });
  },
  advisorConsultations(token: string) {
    return request<AdvisorConsultation[]>('/consultations/advisor/mine', { token });
  },
  products(token: string) {
    return request<Product[]>('/products', { token });
  },
  saveDraft(token: string, consultationId: string, input: RecordInput) {
    return request<ConsultationRecord>(`/consultations/${consultationId}/record`, {
      method: 'PATCH',
      token,
      body: input,
    });
  },
  finalizeRecord(token: string, consultationId: string, input: RecordInput) {
    return request<ConsultationRecord>(`/consultations/${consultationId}/record/finalize`, {
      method: 'POST',
      token,
      body: input,
    });
  },
  operatorConsultations(token: string) {
    return request<OperatorConsultation[]>('/operator/consultations', { token });
  },
  operatorConsultation(token: string, id: string) {
    return request<OperatorConsultation>(`/operator/consultations/${id}`, { token });
  },
  dashboard(token: string) {
    return request<Dashboard>('/operator/dashboard', { token });
  },
  pendingExternalDelegations(token: string) {
    return request<PendingDelegation[]>('/delegations/pending-external', { token });
  },
  verifyExternalDelegation(token: string, id: string) {
    return request<{ id: string; status: string; consentMethod: string }>(`/delegations/${id}/external-verify`, {
      method: 'PATCH',
      token,
      body: { note: 'Verified through external lawful process' },
    });
  },
  requestDelegation(token: string, testResultId: string, delegateEmail: string) {
    return request<{ id: string; status: string }>('/delegations', {
      method: 'POST',
      token,
      body: { testResultId, delegateEmail },
    });
  },
  myPendingDelegations(token: string) {
    return request<MyDelegation[]>('/delegations/pending-consent', { token });
  },
  approveDelegation(token: string, id: string) {
    return request<{ id: string; status: string }>(`/delegations/${id}/approve`, {
      method: 'PATCH',
      token,
    });
  },
  rejectDelegation(token: string, id: string) {
    return request<{ id: string; status: string }>(`/delegations/${id}/reject`, {
      method: 'PATCH',
      token,
    });
  },
  runNoShowBatch(token: string) {
    return request<{ count: number; noShows: number; notAttended: number }>('/operator/batch/no-shows', {
      method: 'POST',
      token,
    });
  },
};

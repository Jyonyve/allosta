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

export type ConsultationStatus = 'RESERVED' | 'DOCUMENTING' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';

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

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  token?: string;
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
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
  reserve(token: string, testResultId: string, scheduledStartAt: string) {
    return request<Consultation>('/consultations', {
      method: 'POST',
      token,
      body: { testResultId, scheduledStartAt },
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
};

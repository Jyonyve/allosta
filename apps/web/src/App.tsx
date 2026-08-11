import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, api } from './api';
import type { Consultation, Session, TestResult } from './api';
import './App.css';

const SESSION_KEY = 'alostar.customer.session';
const KST = 'Asia/Seoul';

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: KST,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: KST,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: KST,
  hour: 'numeric',
  minute: '2-digit',
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: KST,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function readSession(): Session | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? (JSON.parse(stored) as Session) : null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function dayKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const next = await api.login(email.trim(), password);
      if (next.user.role !== 'CUSTOMER') {
        throw new Error('This portal is currently available to customers only.');
      }
      onLogin(next);
    } catch (nextError) {
      setError(messageFor(nextError));
    } finally {
      setBusy(false);
    }
  }

  function useDemo() {
    setEmail('customer@demo.local');
    setPassword('DemoPass123!');
    setError('');
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-labelledby="welcome-title">
        <a className="brand brand--light" href="/" aria-label="Alostar home">
          <span className="brand-mark" aria-hidden="true">
            a
          </span>
          <span>alostar</span>
        </a>
        <div className="story-copy">
          <p className="eyebrow eyebrow--light">Your results, made clearer</p>
          <h1 id="welcome-title">A thoughtful conversation about your health results.</h1>
          <p>
            Review your available test results, choose a convenient time, and connect with the right advisor—without
            having to search for one.
          </p>
        </div>
        <div className="story-note">
          <span aria-hidden="true">✦</span>
          <p>Secure, private, and centered on your questions.</p>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <p className="eyebrow">Customer portal</p>
          <h2 id="login-title">Welcome back</h2>
          <p className="muted">Sign in to review your results and consultations.</p>

          <form onSubmit={submit} className="login-form">
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                minLength={8}
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button--primary button--wide" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="demo-access">
            <div>
              <strong>Trying the demo?</strong>
              <span>Use the seeded customer account.</span>
            </div>
            <button type="button" className="text-button" onClick={useDemo}>
              Fill demo login
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function ResultCard({ result, selected, onSelect }: { result: TestResult; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`result-card${selected ? ' result-card--selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="result-icon" aria-hidden="true">
        {result.testType.name.charAt(0)}
      </span>
      <span className="result-copy">
        <span className="result-category">{result.testType.category.name}</span>
        <strong>{result.testType.name}</strong>
        <span>
          {result.examinee.name} · Tested {fullDateFormatter.format(new Date(result.testedAt))}
        </span>
      </span>
      <span className="result-check" aria-hidden="true">
        {selected ? '✓' : '›'}
      </span>
    </button>
  );
}

function BookingView({
  token,
  results,
  onReserved,
  onUnauthorized,
}: {
  token: string;
  results: TestResult[];
  onReserved: () => Promise<void>;
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(results[0]?.id ?? '');
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [booking, setBooking] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const selectedResult = results.find((result) => result.id === selectedId);
  const groupedSlots = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const slot of slots) {
      const key = dayKey(slot);
      groups.set(key, [...(groups.get(key) ?? []), slot]);
    }
    return groups;
  }, [slots]);
  const days = [...groupedSlots.keys()];

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    api
      .availableSlots(token, selectedId)
      .then((nextSlots) => {
        if (!active) return;
        setSlots(nextSlots);
        setSelectedDay(nextSlots[0] ? dayKey(nextSlots[0]) : '');
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) onUnauthorized();
        else setNotice({ kind: 'error', text: messageFor(error) });
      })
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [onUnauthorized, selectedId, token]);

  function selectResult(id: string) {
    if (id === selectedId) return;
    setLoadingSlots(true);
    setSelectedSlot('');
    setNotice(null);
    setSelectedId(id);
  }

  async function reserve() {
    if (!selectedResult || !selectedSlot) return;
    setBooking(true);
    setNotice(null);
    try {
      await api.reserve(token, selectedResult.id, selectedSlot);
      setSlots((current) => current.filter((slot) => slot !== selectedSlot));
      setSelectedSlot('');
      setNotice({ kind: 'success', text: 'Your consultation is reserved. You can review it in My consultations.' });
      await onReserved();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onUnauthorized();
      else setNotice({ kind: 'error', text: messageFor(error) });
    } finally {
      setBooking(false);
    }
  }

  if (!results.length) {
    return (
      <section className="empty-state">
        <span aria-hidden="true">○</span>
        <h2>No test results are available yet</h2>
        <p>Results you own or have approved consent to access will appear here.</p>
      </section>
    );
  }

  return (
    <div className="booking-layout">
      <section className="workspace-section" aria-labelledby="results-title">
        <div className="section-heading">
          <div>
            <p className="step-label">Step 1</p>
            <h2 id="results-title">Choose a test result</h2>
          </div>
          <span className="count-pill">{results.length} available</span>
        </div>
        <div className="result-list">
          {results.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              selected={result.id === selectedId}
              onSelect={() => selectResult(result.id)}
            />
          ))}
        </div>
        {selectedResult?.summary && (
          <div className="result-summary">
            <span>Result note</span>
            <p>{selectedResult.summary}</p>
          </div>
        )}
      </section>

      <section className="workspace-section slots-section" aria-labelledby="slots-title">
        <div className="section-heading">
          <div>
            <p className="step-label">Step 2</p>
            <h2 id="slots-title">Choose a time</h2>
          </div>
          <span className="timezone">Korea time</span>
        </div>

        {loadingSlots ? (
          <div className="slot-loading" role="status">
            <span className="spinner" /> Finding available advisors…
          </div>
        ) : days.length ? (
          <>
            <div className="day-tabs" role="tablist" aria-label="Available dates">
              {days.map((day) => {
                const firstSlot = groupedSlots.get(day)?.[0];
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedDay === day}
                    className={selectedDay === day ? 'active' : ''}
                    key={day}
                    onClick={() => {
                      setSelectedDay(day);
                      setSelectedSlot('');
                    }}
                  >
                    {firstSlot && dayFormatter.format(new Date(firstSlot))}
                  </button>
                );
              })}
            </div>
            <fieldset className="time-grid">
              <legend className="sr-only">Available appointment times</legend>
              {(groupedSlots.get(selectedDay) ?? []).map((slot) => (
                <label key={slot} className={selectedSlot === slot ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="appointment-time"
                    value={slot}
                    checked={selectedSlot === slot}
                    onChange={() => setSelectedSlot(slot)}
                  />
                  {timeFormatter.format(new Date(slot))}
                </label>
              ))}
            </fieldset>
            <div className="booking-footer">
              <div>
                <span>Your selection</span>
                <strong>
                  {selectedSlot ? dateTimeFormatter.format(new Date(selectedSlot)) : 'Select an available time'}
                </strong>
              </div>
              <button
                className="button button--primary"
                type="button"
                disabled={!selectedSlot || booking}
                onClick={reserve}
              >
                {booking ? 'Reserving…' : 'Reserve consultation'}
              </button>
            </div>
          </>
        ) : (
          <div className="no-slots">
            <span aria-hidden="true">◷</span>
            <h3>No available times right now</h3>
            <p>Try another test result or check back after advisors add availability.</p>
          </div>
        )}
        {notice && (
          <p className={`notice notice--${notice.kind}`} role="status">
            {notice.text}
          </p>
        )}
      </section>
    </div>
  );
}

const statusLabels: Record<Consultation['status'], string> = {
  RESERVED: 'Reserved',
  DOCUMENTING: 'In progress',
  COMPLETED: 'Completed',
  NO_SHOW: 'No show',
  CANCELLED: 'Cancelled',
};

function ConsultationsView({
  consultations,
  loading,
  onCancel,
}: {
  consultations: Consultation[];
  loading: boolean;
  onCancel: (id: string) => Promise<void>;
}) {
  const [now] = useState(() => Date.now());
  const [cancellingId, setCancellingId] = useState('');
  const [error, setError] = useState('');

  async function cancel(consultation: Consultation) {
    const confirmed = window.confirm(
      `Cancel your consultation on ${dateTimeFormatter.format(new Date(consultation.scheduledStartAt))}?`,
    );
    if (!confirmed) return;
    setCancellingId(consultation.id);
    setError('');
    try {
      await onCancel(consultation.id);
    } catch (nextError) {
      setError(messageFor(nextError));
    } finally {
      setCancellingId('');
    }
  }

  if (loading)
    return (
      <div className="page-loading" role="status">
        <span className="spinner" /> Loading consultations…
      </div>
    );
  if (!consultations.length)
    return (
      <section className="empty-state">
        <span aria-hidden="true">◇</span>
        <h2>No consultations yet</h2>
        <p>Once you reserve a time, the appointment will appear here.</p>
      </section>
    );

  return (
    <section className="consultations-section" aria-labelledby="consultations-title">
      <div className="section-heading section-heading--page">
        <div>
          <p className="eyebrow">Your schedule</p>
          <h2 id="consultations-title">My consultations</h2>
        </div>
        <span className="count-pill">{consultations.length} total</span>
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      <div className="consultation-list">
        {consultations.map((consultation) => {
          const start = new Date(consultation.scheduledStartAt);
          const cancellable = consultation.status === 'RESERVED' && start.getTime() - now >= 3_600_000;
          return (
            <article className="consultation-card" key={consultation.id}>
              <div className="date-tile" aria-hidden="true">
                <span>{new Intl.DateTimeFormat('en-US', { timeZone: KST, month: 'short' }).format(start)}</span>
                <strong>{new Intl.DateTimeFormat('en-US', { timeZone: KST, day: '2-digit' }).format(start)}</strong>
              </div>
              <div className="consultation-main">
                <div className="consultation-title-row">
                  <div>
                    <span className={`status status--${consultation.status.toLowerCase()}`}>
                      {statusLabels[consultation.status]}
                    </span>
                    <h3>{consultation.testResult.testType.name}</h3>
                  </div>
                  <strong className="consultation-time">{timeFormatter.format(start)}</strong>
                </div>
                <dl className="consultation-details">
                  <div>
                    <dt>Examinee</dt>
                    <dd>{consultation.testResult.examinee.name}</dd>
                  </div>
                  <div>
                    <dt>Advisor</dt>
                    <dd>{consultation.advisor.user.name}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{dayFormatter.format(start)} · Korea time</dd>
                  </div>
                </dl>
                {consultation.record?.status === 'FINAL' && consultation.record.summary && (
                  <p className="record-summary">
                    <strong>Consultation summary</strong>
                    {consultation.record.summary}
                  </p>
                )}
                {cancellable && (
                  <button
                    type="button"
                    className="button button--danger-quiet"
                    disabled={cancellingId === consultation.id}
                    onClick={() => cancel(consultation)}
                  >
                    {cancellingId === consultation.id ? 'Cancelling…' : 'Cancel reservation'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Portal({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [view, setView] = useState<'book' | 'consultations'>('book');
  const [results, setResults] = useState<TestResult[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    onLogout();
  }, [onLogout]);

  const loadConsultations = useCallback(async () => {
    const next = await api.consultations(session.accessToken);
    setConsultations(next);
  }, [session.accessToken]);

  useEffect(() => {
    let active = true;
    Promise.all([api.testResults(session.accessToken), api.consultations(session.accessToken)])
      .then(([nextResults, nextConsultations]) => {
        if (!active) return;
        setResults(nextResults);
        setConsultations(nextConsultations);
      })
      .catch((nextError: unknown) => {
        if (!active) return;
        if (nextError instanceof ApiError && nextError.status === 401) handleUnauthorized();
        else setError(messageFor(nextError));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [handleUnauthorized, session.accessToken]);

  async function cancelConsultation(id: string) {
    try {
      await api.cancel(session.accessToken, id);
      await loadConsultations();
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) handleUnauthorized();
      throw nextError;
    }
  }

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <a className="brand" href="/" aria-label="Alostar customer portal">
          <span className="brand-mark" aria-hidden="true">
            a
          </span>
          <span>alostar</span>
        </a>
        <nav aria-label="Customer portal">
          <button className={view === 'book' ? 'active' : ''} onClick={() => setView('book')}>
            Book consultation
          </button>
          <button className={view === 'consultations' ? 'active' : ''} onClick={() => setView('consultations')}>
            My consultations
          </button>
        </nav>
        <div className="account-menu">
          <span className="avatar" aria-hidden="true">
            {session.user.name.charAt(0).toUpperCase()}
          </span>
          <span className="account-copy">
            <strong>{session.user.name}</strong>
            <small>{session.user.email}</small>
          </span>
          <button type="button" className="logout-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="portal-main">
        <div className="page-intro">
          <div>
            <p className="eyebrow">Good to see you, {session.user.name.split(' ')[0]}</p>
            <h1>{view === 'book' ? 'Book a consultation' : 'Your consultation history'}</h1>
            <p>
              {view === 'book'
                ? 'Choose a result and a time. We’ll assign the right available advisor.'
                : 'Review upcoming appointments and completed conversations.'}
            </p>
          </div>
          {view === 'book' && (
            <div className="privacy-note">
              <span aria-hidden="true">✓</span>
              <p>
                <strong>Advisor matched automatically</strong>
                <br />
                Based on your test type and availability
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="page-loading" role="status">
            <span className="spinner" /> Loading your health workspace…
          </div>
        ) : view === 'book' ? (
          <BookingView
            token={session.accessToken}
            results={results}
            onReserved={loadConsultations}
            onUnauthorized={handleUnauthorized}
          />
        ) : (
          <ConsultationsView consultations={consultations} loading={false} onCancel={cancelConsultation} />
        )}
      </main>

      <footer>
        <span>Alostar consultation services</span>
        <span>Business timezone: Asia/Seoul</span>
      </footer>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());

  function login(next: Session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  }
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  return session ? <Portal session={session} onLogout={logout} /> : <Login onLogin={login} />;
}

export default App;

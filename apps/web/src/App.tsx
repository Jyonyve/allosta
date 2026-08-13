import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, api } from './api';
import type { Consultation, Session, TestResult } from './api';
import { AdvisorPortal } from './AdvisorPortal';
import { LanguageSwitcher, useI18n } from './i18n';
import { OperatorPortal } from './OperatorPortal';
import './App.css';

const SESSION_KEY = 'alostar.customer.session';
const KST = 'Asia/Seoul';

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

function messageFor(error: unknown, t: (key: string) => string) {
  return t(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const { t } = useI18n();
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
      onLogin(next);
    } catch (nextError) {
      setError(messageFor(nextError, t));
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(role: 'customer' | 'advisor' | 'operator') {
    setEmail(
      role === 'customer' ? 'customer@demo.local' : role === 'advisor' ? 'advisor1@demo.local' : 'operator@demo.local',
    );
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
          <p className="eyebrow eyebrow--light">{t('Your results, made clearer')}</p>
          <h1 id="welcome-title">{t('A thoughtful conversation about your health results.')}</h1>
          <p>
            {t(
              'Review your available test results, choose a convenient time, and connect with the right advisor—without having to search for one.',
            )}
          </p>
        </div>
        <div className="story-note">
          <span aria-hidden="true">✦</span>
          <p>{t('Secure, private, and centered on your questions.')}</p>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-language">
            <LanguageSwitcher />
          </div>
          <p className="eyebrow">{t('Consultation portal')}</p>
          <h2 id="login-title">{t('Welcome back')}</h2>
          <p className="muted">{t('Sign in to review your results and consultations.')}</p>

          <form onSubmit={submit} className="login-form">
            <label>
              {t('Email address')}
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
              {t('Password')}
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('Enter your password')}
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
              {busy ? t('Signing in…') : t('Sign in')}
            </button>
          </form>

          <div className="demo-access">
            <div>
              <strong>{t('Trying the demo?')}</strong>
              <span>{t('Choose a seeded portal account.')}</span>
            </div>
            <div className="demo-buttons">
              <button type="button" className="text-button" onClick={() => fillDemo('customer')}>
                {t('Customer')}
              </button>
              <button type="button" className="text-button" onClick={() => fillDemo('advisor')}>
                {t('Advisor')}
              </button>
              <button type="button" className="text-button" onClick={() => fillDemo('operator')}>
                {t('Operator')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ResultCard({ result, selected, onSelect }: { result: TestResult; selected: boolean; onSelect: () => void }) {
  const { t, formatDate } = useI18n();
  return (
    <button
      type="button"
      className={`result-card${selected ? ' result-card--selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="result-icon" aria-hidden="true">
        {t(result.testType.name).charAt(0)}
      </span>
      <span className="result-copy">
        <span className="result-category">{t(result.testType.category.name)}</span>
        <strong>{t(result.testType.name)}</strong>
        <span>
          {result.examinee.name} · {t('Tested')}{' '}
          {formatDate(result.testedAt, { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </span>
      <span className="result-check" aria-hidden="true">
        {selected ? '✓' : '›'}
      </span>
    </button>
  );
}

function ChangeReservationModal({
  existing,
  newSlot,
  busy,
  onCancel,
  onConfirm,
}: {
  existing: Consultation;
  newSlot: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t, formatDate } = useI18n();
  const [now] = useState(() => Date.now());
  const past = new Date(existing.scheduledStartAt).getTime() < now;
  const dateTime = (value: string) =>
    formatDate(value, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="change-reservation-title">
        <p className="eyebrow">{past ? t('Previous time missed') : t('Change reservation')}</p>
        <h2 id="change-reservation-title">{past ? t('Book a new time') : t('Want to change reservation?')}</h2>
        <p>
          {past
            ? t('Your consultation on {old} was not attended. Book {new} instead?', {
                old: dateTime(existing.scheduledStartAt),
                new: dateTime(newSlot),
              })
            : t('You already have a consultation on {old}. Change it to {new}?', {
                old: dateTime(existing.scheduledStartAt),
                new: dateTime(newSlot),
              })}
        </p>
        <div className="modal-actions">
          <button className="button button--secondary" type="button" onClick={onCancel} disabled={busy}>
            {t('Keep current')}
          </button>
          <button className="button button--primary" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? t('Changing…') : past ? t('Book new time') : t('Change reservation')}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingView({
  token,
  results,
  consultations,
  onReserved,
  onUnauthorized,
}: {
  token: string;
  results: TestResult[];
  consultations: Consultation[];
  onReserved: () => Promise<void>;
  onUnauthorized: () => void;
}) {
  const { t, formatDate } = useI18n();
  const [selectedId, setSelectedId] = useState(results[0]?.id ?? '');
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [booking, setBooking] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [now] = useState(() => Date.now());

  const selectedResult = results.find((result) => result.id === selectedId);
  const existingActive = consultations.find(
    (item) => item.testResult.id === selectedId && (item.status === 'RESERVED' || item.status === 'DOCUMENTING'),
  );
  const existingPast = existingActive ? new Date(existingActive.scheduledStartAt).getTime() < now : false;
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
        else setNotice({ kind: 'error', text: messageFor(error, t) });
      })
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [onUnauthorized, selectedId, t, token]);

  function selectResult(id: string) {
    if (id === selectedId) return;
    setLoadingSlots(true);
    setSelectedSlot('');
    setNotice(null);
    setSelectedId(id);
  }

  async function doReserve(replaceExisting: boolean) {
    if (!selectedResult || !selectedSlot) return;
    setBooking(true);
    setNotice(null);
    try {
      await api.reserve(token, selectedResult.id, selectedSlot, replaceExisting);
      setSlots((current) => current.filter((slot) => slot !== selectedSlot));
      setSelectedSlot('');
      setShowChangeModal(false);
      setNotice({
        kind: 'success',
        text: replaceExisting
          ? t('Your consultation was changed to the new time.')
          : t('Your consultation is reserved. You can review it in My consultations.'),
      });
      await onReserved();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onUnauthorized();
      else setNotice({ kind: 'error', text: messageFor(error, t) });
    } finally {
      setBooking(false);
    }
  }

  function handleReserve() {
    if (!selectedResult || !selectedSlot) return;
    if (existingActive) {
      if (existingActive.status === 'DOCUMENTING') {
        setNotice({
          kind: 'error',
          text: t('A consultation record for this result is already in progress and cannot be replaced.'),
        });
        return;
      }
      setShowChangeModal(true);
      return;
    }
    doReserve(false);
  }

  if (!results.length) {
    return (
      <section className="empty-state">
        <span aria-hidden="true">○</span>
        <h2>{t('No test results are available yet')}</h2>
        <p>{t('Results you own or have approved consent to access will appear here.')}</p>
      </section>
    );
  }

  return (
    <div className="booking-layout">
      <section className="workspace-section" aria-labelledby="results-title">
        <div className="section-heading">
          <div>
            <p className="step-label">{t('Step 1')}</p>
            <h2 id="results-title">{t('Choose a test result')}</h2>
          </div>
          <span className="count-pill">{t('{count} available', { count: results.length })}</span>
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
            <span>{t('Result note')}</span>
            <p>{selectedResult.summary}</p>
          </div>
        )}
        {existingActive && (
          <p className="notice notice--info" role="status">
            {existingActive.status === 'DOCUMENTING'
              ? t('A consultation for this result is already in progress.')
              : existingPast
                ? t(
                    'Your reservation on {date} was not attended. You can book a new time.',
                    {
                      date: formatDate(existingActive.scheduledStartAt, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }),
                    },
                  )
                : t(
                    'You already have a reservation for this result on {date}. Choose a new time to change it.',
                    {
                      date: formatDate(existingActive.scheduledStartAt, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }),
                    },
                  )}
          </p>
        )}
      </section>

      <section className="workspace-section slots-section" aria-labelledby="slots-title">
        <div className="section-heading">
          <div>
            <p className="step-label">{t('Step 2')}</p>
            <h2 id="slots-title">{t('Choose a time')}</h2>
          </div>
          <span className="timezone">{t('Korea time')}</span>
        </div>

        {loadingSlots ? (
          <div className="slot-loading" role="status">
            <span className="spinner" /> {t('Finding available advisors…')}
          </div>
        ) : days.length ? (
          <>
            <div className="day-tabs" role="tablist" aria-label={t('Available dates')}>
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
                    {firstSlot && formatDate(firstSlot, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </button>
                );
              })}
            </div>
            <fieldset className="time-grid">
              <legend className="sr-only">{t('Available appointment times')}</legend>
              {(groupedSlots.get(selectedDay) ?? []).map((slot) => (
                <label key={slot} className={selectedSlot === slot ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="appointment-time"
                    value={slot}
                    checked={selectedSlot === slot}
                    onChange={() => setSelectedSlot(slot)}
                  />
                  {formatDate(slot, { hour: 'numeric', minute: '2-digit' })}
                </label>
              ))}
            </fieldset>
            <div className="booking-footer">
              <div>
                <span>{t('Your selection')}</span>
                <strong>
                  {selectedSlot
                    ? formatDate(selectedSlot, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : t('Select an available time')}
                </strong>
              </div>
              <button
                className="button button--primary"
                type="button"
                disabled={!selectedSlot || booking}
                onClick={handleReserve}
              >
                {booking ? t('Reserving…') : t('Reserve consultation')}
              </button>
            </div>
          </>
        ) : (
          <div className="no-slots">
            <span aria-hidden="true">◷</span>
            <h3>{t('No available times right now')}</h3>
            <p>{t('Try another test result or check back after advisors add availability.')}</p>
          </div>
        )}
        {notice && (
          <p className={`notice notice--${notice.kind}`} role="status">
            {notice.text}
          </p>
        )}
      </section>
      {showChangeModal && existingActive && selectedSlot && (
        <ChangeReservationModal
          existing={existingActive}
          newSlot={selectedSlot}
          busy={booking}
          onCancel={() => setShowChangeModal(false)}
          onConfirm={() => doReserve(true)}
        />
      )}
    </div>
  );
}

const statusLabels: Record<Consultation['status'], string> = {
  RESERVED: 'Reserved',
  DOCUMENTING: 'In progress',
  COMPLETED: 'Completed',
  NO_SHOW: 'No show',
  NOT_ATTENDED: 'Not attended',
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
  const { t, formatDate } = useI18n();
  const [now] = useState(() => Date.now());
  const [cancellingId, setCancellingId] = useState('');
  const [error, setError] = useState('');

  async function cancel(consultation: Consultation) {
    const confirmed = window.confirm(
      t('Cancel your consultation on {date}?', {
        date: formatDate(consultation.scheduledStartAt, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
      }),
    );
    if (!confirmed) return;
    setCancellingId(consultation.id);
    setError('');
    try {
      await onCancel(consultation.id);
    } catch (nextError) {
      setError(messageFor(nextError, t));
    } finally {
      setCancellingId('');
    }
  }

  if (loading)
    return (
      <div className="page-loading" role="status">
        <span className="spinner" /> {t('Loading consultations…')}
      </div>
    );
  if (!consultations.length)
    return (
      <section className="empty-state">
        <span aria-hidden="true">◇</span>
        <h2>{t('No consultations yet')}</h2>
        <p>{t('Once you reserve a time, the appointment will appear here.')}</p>
      </section>
    );

  return (
    <section className="consultations-section" aria-labelledby="consultations-title">
      <div className="section-heading section-heading--page">
        <div>
          <p className="eyebrow">{t('Your schedule')}</p>
          <h2 id="consultations-title">{t('My consultations')}</h2>
        </div>
        <span className="count-pill">{t('{count} total', { count: consultations.length })}</span>
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
                <span>{formatDate(start, { month: 'short' })}</span>
                <strong>{formatDate(start, { day: '2-digit' })}</strong>
              </div>
              <div className="consultation-main">
                <div className="consultation-title-row">
                  <div>
                    <span className={`status status--${consultation.status.toLowerCase()}`}>
                      {t(statusLabels[consultation.status])}
                    </span>
                    <h3>{t(consultation.testResult.testType.name)}</h3>
                  </div>
                  <strong className="consultation-time">
                    {formatDate(start, { hour: 'numeric', minute: '2-digit' })}
                  </strong>
                </div>
                <dl className="consultation-details">
                  <div>
                    <dt>{t('Examinee')}</dt>
                    <dd>{consultation.testResult.examinee.name}</dd>
                  </div>
                  <div>
                    <dt>{t('Advisor')}</dt>
                    <dd>{consultation.advisor.user.name}</dd>
                  </div>
                  <div>
                    <dt>{t('Date')}</dt>
                    <dd>
                      {formatDate(start, { weekday: 'short', month: 'short', day: 'numeric' })} · {t('Korea time')}
                    </dd>
                  </div>
                </dl>
                {consultation.record?.status === 'FINAL' && consultation.record.summary && (
                  <p className="record-summary">
                    <strong>{t('Consultation summary')}</strong>
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
                    {cancellingId === consultation.id ? t('Cancelling…') : t('Cancel reservation')}
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

function CustomerPortal({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { t } = useI18n();
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
        else setError(messageFor(nextError, t));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [handleUnauthorized, session.accessToken, t]);

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
        <nav aria-label={t('Customer portal')}>
          <button className={view === 'book' ? 'active' : ''} onClick={() => setView('book')}>
            {t('Book consultation')}
          </button>
          <button className={view === 'consultations' ? 'active' : ''} onClick={() => setView('consultations')}>
            {t('My consultations')}
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
          <LanguageSwitcher />
          <button type="button" className="logout-button" onClick={onLogout}>
            {t('Log out')}
          </button>
        </div>
      </header>

      <main className="portal-main">
        <div className="page-intro">
          <div>
            <p className="eyebrow">{t('Good to see you, {name}', { name: session.user.name.split(' ')[0] })}</p>
            <h1>{view === 'book' ? t('Book a consultation') : t('Your consultation history')}</h1>
            <p>
              {view === 'book'
                ? t('Choose a result and a time. We’ll assign the right available advisor.')
                : t('Review upcoming appointments and completed conversations.')}
            </p>
          </div>
          {view === 'book' && (
            <div className="privacy-note">
              <span aria-hidden="true">✓</span>
              <p>
                <strong>{t('Advisor matched automatically')}</strong>
                <br />
                {t('Based on your test type and availability')}
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
            <span className="spinner" /> {t('Loading your health workspace…')}
          </div>
        ) : view === 'book' ? (
          <BookingView
            token={session.accessToken}
            results={results}
            consultations={consultations}
            onReserved={loadConsultations}
            onUnauthorized={handleUnauthorized}
          />
        ) : (
          <ConsultationsView consultations={consultations} loading={false} onCancel={cancelConsultation} />
        )}
      </main>

      <footer>
        <span>{t('Alostar consultation services')}</span>
        <span>{t('Business timezone: Asia/Seoul')}</span>
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

  if (!session) return <Login onLogin={login} />;
  if (session.user.role === 'ADVISOR') return <AdvisorPortal session={session} onLogout={logout} />;
  if (session.user.role === 'OPERATOR') return <OperatorPortal session={session} onLogout={logout} />;
  return <CustomerPortal session={session} onLogout={logout} />;
}

export default App;

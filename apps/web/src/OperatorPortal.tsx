import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from './api';
import type { Dashboard, OperatorConsultation, PendingDelegation, Session } from './api';
import { LanguageSwitcher, useI18n } from './i18n';

type View = 'dashboard' | 'consultations' | 'consent';

const statusLabels: Record<string, string> = {
  RESERVED: 'Reserved',
  DOCUMENTING: 'Documenting',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
  NOT_ATTENDED: 'Not attended',
  CANCELLED: 'Cancelled',
};

function percent(value: number | null | undefined) {
  return value == null ? '—' : `${Math.round(value * 100)}%`;
}

function messageFor(error: unknown, t: (key: string) => string) {
  return t(error instanceof Error ? error.message : 'The request could not be completed.');
}

function totalCounts(counts: Dashboard['counts']) {
  return Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);
}

function DashboardView({
  data,
  runningBatch,
  batchNotice,
  onRunBatch,
}: {
  data: Dashboard;
  runningBatch: boolean;
  batchNotice: string;
  onRunBatch: () => void;
}) {
  const { t } = useI18n();
  const total = totalCounts(data.counts);
  const statuses = ['RESERVED', 'DOCUMENTING', 'COMPLETED', 'NO_SHOW', 'NOT_ATTENDED', 'CANCELLED'] as const;

  return (
    <>
      <section className="operator-metric-grid" aria-label={t('Consultation metrics')}>
        <article>
          <span>{t('Total consultations')}</span>
          <strong>{total}</strong>
          <small>{t('All recorded appointments')}</small>
        </article>
        <article>
          <span>{t('Completion rate')}</span>
          <strong>{percent(data.completionRate)}</strong>
          <small>{t('Completed consultations')}</small>
        </article>
        <article>
          <span>{t('Non-attendance rate')}</span>
          <strong>{percent(data.nonAttendanceRate)}</strong>
          <small>{t('Appointments missed')}</small>
        </article>
        <article>
          <span>{t('Upcoming')}</span>
          <strong>{data.counts.RESERVED ?? 0}</strong>
          <small>{t('Currently reserved')}</small>
        </article>
      </section>

      <div className="operator-dashboard-grid">
        <section className="operator-card" aria-labelledby="status-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('Service overview')}</p>
              <h2 id="status-title">{t('Consultation status')}</h2>
            </div>
          </div>
          <div className="status-bars">
            {statuses.map((status) => {
              const count = data.counts[status] ?? 0;
              const width = total ? (count / total) * 100 : 0;
              return (
                <div key={status}>
                  <span>{t(statusLabels[status])}</span>
                  <div>
                    <i style={{ width: `${width}%` }} />
                  </div>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="operator-card batch-card" aria-labelledby="batch-title">
          <p className="eyebrow">{t('Daily control')}</p>
          <h2 id="batch-title">{t('Non-attendance processing')}</h2>
          <p>{t('Mark overdue reserved consultations that were never documented as not attended. This operation is safe to run more than once.')}</p>
          <button className="button button--secondary" onClick={onRunBatch} disabled={runningBatch}>
            {runningBatch ? t('Processing…') : t('Run attendance check')}
          </button>
          {batchNotice && (
            <p className="operator-batch-notice" role="status">
              {batchNotice}
            </p>
          )}
        </section>
      </div>

      <section className="operator-card" aria-labelledby="advisor-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('Team performance')}</p>
            <h2 id="advisor-title">{t('Advisor activity')}</h2>
          </div>
        </div>
        <div className="operator-table-wrap">
          <table className="advisor-performance">
            <thead>
              <tr>
                <th>{t('Advisor')}</th>
                <th>{t('State')}</th>
                <th>{t('Reserved')}</th>
                <th>{t('Completed')}</th>
                <th>{t('Completion')}</th>
                <th>{t('Non-attendance')}</th>
              </tr>
            </thead>
            <tbody>
              {data.advisorStatistics.map((advisor) => (
                <tr key={advisor.advisorId}>
                  <td>
                    <strong>{advisor.name}</strong>
                  </td>
                  <td>
                    <span className={`advisor-state advisor-state--${advisor.active ? 'active' : 'inactive'}`}>
                      {advisor.active ? t('Active') : t('Inactive')}
                    </span>
                  </td>
                  <td>{advisor.counts.RESERVED ?? 0}</td>
                  <td>{advisor.counts.COMPLETED ?? 0}</td>
                  <td>{percent(advisor.completionRate)}</td>
                  <td>{percent(advisor.nonAttendanceRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.advisorStatistics.length && (
          <p className="operator-empty-copy">{t('No advisor activity is available yet.')}</p>
        )}
      </section>

      <section className="operator-card" aria-labelledby="products-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('Customer interest')}</p>
            <h2 id="products-title">{t('Interested products')}</h2>
          </div>
        </div>
        <div className="product-rankings">
          {data.interestedProducts.map(({ product, count }, index) => (
            <div key={product.id}>
              <span>{index + 1}</span>
              <div>
                <strong>{t(product.name)}</strong>
                <small>{product.category ? t(product.category) : t('Uncategorized')}</small>
              </div>
              <b>{count}</b>
            </div>
          ))}
          {!data.interestedProducts.length && (
            <p className="operator-empty-copy">{t('No products have been recorded yet.')}</p>
          )}
        </div>
      </section>
    </>
  );
}

function ConsultationDetail({ consultation }: { consultation: OperatorConsultation | null }) {
  const { t, formatDate } = useI18n();
  if (!consultation)
    return (
      <section className="operator-card operator-detail operator-detail--empty">
        <span aria-hidden="true">↗</span>
        <h2>{t('Select a consultation')}</h2>
        <p>{t('Choose an appointment to inspect its operational record.')}</p>
      </section>
    );
  return (
    <section className="operator-card operator-detail" aria-live="polite">
      <div className="operator-detail-head">
        <div>
          <p className="eyebrow">{t('Consultation record')}</p>
          <h2>{t(consultation.testResult.testType.name)}</h2>
        </div>
        <span className={`status status--${consultation.status.toLowerCase()}`}>
          {t(statusLabels[consultation.status])}
        </span>
      </div>
      <dl>
        <div>
          <dt>{t('Scheduled')}</dt>
          <dd>
            {formatDate(consultation.scheduledStartAt, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </dd>
        </div>
        <div>
          <dt>{t('Examinee')}</dt>
          <dd>{consultation.testResult.examinee.name}</dd>
        </div>
        <div>
          <dt>{t('Requester')}</dt>
          <dd>
            {consultation.requester.name}
            <small>{consultation.requester.email}</small>
          </dd>
        </div>
        <div>
          <dt>{t('Advisor')}</dt>
          <dd>
            {consultation.advisor.user.name}
            <small>{consultation.advisor.user.email}</small>
          </dd>
        </div>
        <div>
          <dt>{t('Consent')}</dt>
          <dd>
            {consultation.delegation
              ? `${t(consultation.delegation.status)} · ${t(consultation.delegation.consentMethod ?? 'Pending method')}`
              : t('Direct access')}
          </dd>
        </div>
        <div>
          <dt>{t('Result date')}</dt>
          <dd>
            {formatDate(consultation.testResult.testedAt, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </dd>
        </div>
      </dl>
      <div className="operator-record">
        <h3>{t('Consultation notes')}</h3>
        {consultation.record ? (
          <>
            <p>{consultation.record.summary || t('No summary entered.')}</p>
            <div className="record-interest">
              <h4>{t('Interested products')}</h4>
              {consultation.record.interestedProducts.length ? (
                <div className="record-products">
                  {consultation.record.interestedProducts.map(({ product }) => (
                    <span key={product.id}>{t(product.name)}</span>
                  ))}
                </div>
              ) : (
                <p className="muted">{t('None selected')}</p>
              )}
            </div>
          </>
        ) : (
          <p className="muted">{t('No consultation record has been started.')}</p>
        )}
      </div>
    </section>
  );
}

function ConsultationsView({ consultations }: { consultations: OperatorConsultation[] }) {
  const { t, formatDate } = useI18n();
  const [filter, setFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState(consultations[0]?.id ?? '');
  const filtered = useMemo(
    () => (filter === 'ALL' ? consultations : consultations.filter((item) => item.status === filter)),
    [consultations, filter],
  );
  const selected = consultations.find((item) => item.id === selectedId) ?? null;
  return (
    <div className="operator-consultation-layout">
      <section className="operator-card operator-list" aria-labelledby="consultations-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('Operations log')}</p>
            <h2 id="consultations-title">{t('All consultations')}</h2>
          </div>
          <select
            className="filter-select"
            aria-label={t('Filter by status')}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="ALL">{t('All statuses')}</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </div>
        <div className="operator-consultation-list">
          {filtered.map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === selectedId ? 'selected' : ''}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="operator-list-date">
                {formatDate(item.scheduledStartAt, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <strong>{t(item.testResult.testType.name)}</strong>
              <small>
                {item.testResult.examinee.name} · {item.advisor.user.name}
              </small>
              <span className={`status status--${item.status.toLowerCase()}`}>{t(statusLabels[item.status])}</span>
            </button>
          ))}
          {!filtered.length && <p className="operator-empty-copy">{t('No consultations match this filter.')}</p>}
        </div>
      </section>
      <ConsultationDetail consultation={selected} />
    </div>
  );
}

function ConsentView({
  pending,
  verifyingId,
  onVerify,
}: {
  pending: PendingDelegation[];
  verifyingId: string;
  onVerify: (id: string) => void;
}) {
  const { t, formatDate } = useI18n();
  return (
    <section className="operator-card consent-queue" aria-labelledby="consent-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('Access governance')}</p>
          <h2 id="consent-title">{t('External consent queue')}</h2>
        </div>
        <strong className="consent-summary">{t('{count} pending', { count: pending.length })}</strong>
      </div>
      <div className="legal-note">
        <span aria-hidden="true">!</span>
        <p>
          <strong>{t('Verify only after completing the lawful external process.')}</strong>{' '}
          {t('Approval grants the delegate access to the examinee’s test result.')}
        </p>
      </div>
      <div className="consent-list">
        {pending.map((item) => (
          <article key={item.id}>
            <span className="consent-avatar" aria-hidden="true">
              {item.delegate.name.charAt(0)}
            </span>
            <div>
              <strong>{item.delegate.name}</strong>
              <small>{item.delegate.email}</small>
            </div>
            <div>
              <span>{t('Requests access to')}</span>
              <strong>
                {item.testResult.examinee.name} · {t(item.testResult.testType.name)}
              </strong>
              <small>
                {t('Submitted {date}', {
                  date: formatDate(item.createdAt, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }),
                })}
              </small>
            </div>
            <button
              className="button button--primary"
              disabled={verifyingId === item.id}
              onClick={() => onVerify(item.id)}
            >
              {verifyingId === item.id ? t('Verifying…') : t('Verify consent')}
            </button>
          </article>
        ))}
        {!pending.length && (
          <div className="operator-empty-copy">
            <strong>{t('Queue clear')}</strong>
            <p>{t('There are no external consent requests awaiting verification.')}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function OperatorPortal({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('dashboard');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [consultations, setConsultations] = useState<OperatorConsultation[]>([]);
  const [pending, setPending] = useState<PendingDelegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runningBatch, setRunningBatch] = useState(false);
  const [batchNotice, setBatchNotice] = useState('');
  const [verifyingId, setVerifyingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextDashboard, nextConsultations, nextPending] = await Promise.all([
        api.dashboard(session.accessToken),
        api.operatorConsultations(session.accessToken),
        api.pendingExternalDelegations(session.accessToken),
      ]);
      setDashboard(nextDashboard);
      setConsultations(nextConsultations);
      setPending(nextPending);
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) onLogout();
      else setError(messageFor(nextError, t));
    } finally {
      setLoading(false);
    }
  }, [onLogout, session.accessToken, t]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.dashboard(session.accessToken),
      api.operatorConsultations(session.accessToken),
      api.pendingExternalDelegations(session.accessToken),
    ])
      .then(([nextDashboard, nextConsultations, nextPending]) => {
        if (!active) return;
        setDashboard(nextDashboard);
        setConsultations(nextConsultations);
        setPending(nextPending);
      })
      .catch((nextError: unknown) => {
        if (!active) return;
        if (nextError instanceof ApiError && nextError.status === 401) onLogout();
        else setError(messageFor(nextError, t));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [onLogout, session.accessToken, t]);

  async function runBatch() {
    setRunningBatch(true);
    setBatchNotice('');
    try {
      const result = await api.runNoShowBatch(session.accessToken);
      setBatchNotice(
        result.count > 0
          ? t(
              result.count === 1
                ? '{count} consultation marked as not attended.'
                : '{count} consultations marked as not attended.',
              { count: result.count },
            )
          : t('No overdue consultations found.'),
      );
      await load();
    } catch (nextError) {
      setBatchNotice(messageFor(nextError, t));
    } finally {
      setRunningBatch(false);
    }
  }

  async function verify(id: string) {
    setVerifyingId(id);
    setError('');
    try {
      await api.verifyExternalDelegation(session.accessToken, id);
      setPending((current) => current.filter((item) => item.id !== id));
    } catch (nextError) {
      if (nextError instanceof ApiError && nextError.status === 401) onLogout();
      else setError(messageFor(nextError, t));
    } finally {
      setVerifyingId('');
    }
  }

  return (
    <div className="portal-shell operator-shell">
      <header className="portal-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Allosta operator home">
          <span className="brand-mark" aria-hidden="true">
            a
          </span>
          <span>
            allosta <em>{t('Operations portal')}</em>
          </span>
        </a>
        <nav aria-label={t('Operations portal')}>
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
            {t('Dashboard')}
          </button>
          <button className={view === 'consultations' ? 'active' : ''} onClick={() => setView('consultations')}>
            {t('Consultations')}
          </button>
          <button className={view === 'consent' ? 'active' : ''} onClick={() => setView('consent')}>
            {t('Consent')} {pending.length > 0 && <span className="nav-count">{pending.length}</span>}
          </button>
        </nav>
        <div className="account-menu">
          <span className="avatar" aria-hidden="true">
            {session.user.name.charAt(0)}
          </span>
          <span className="account-copy">
            <strong>{session.user.name}</strong>
            <small>{t('Operator')}</small>
          </span>
          <LanguageSwitcher />
          <button type="button" className="text-button" onClick={onLogout}>
            {t('Log out')}
          </button>
        </div>
      </header>
      <main className="portal-main operator-main">
        <div className="page-intro">
          <div>
            <p className="eyebrow">{t('Operations center')}</p>
            <h1>
              {view === 'dashboard'
                ? t('Service at a glance')
                : view === 'consultations'
                  ? t('Consultation oversight')
                  : t('Consent verification')}
            </h1>
            <p>
              {view === 'dashboard'
                ? t('Monitor service health, advisor activity, and customer interest.')
                : view === 'consultations'
                  ? t('Review every consultation and its operational context.')
                  : t('Review externally confirmed consent before granting access.')}
            </p>
          </div>
        </div>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="page-loading" role="status">
            <span className="spinner" /> {t('Loading operations workspace…')}
          </div>
        ) : view === 'dashboard' && dashboard ? (
          <DashboardView data={dashboard} runningBatch={runningBatch} batchNotice={batchNotice} onRunBatch={runBatch} />
        ) : view === 'consultations' ? (
          <ConsultationsView consultations={consultations} />
        ) : (
          <ConsentView pending={pending} verifyingId={verifyingId} onVerify={verify} />
        )}
      </main>
      <footer>
        <span>{t('Allosta operations center')}</span>
        <span>{t('Business timezone: Asia/Seoul')}</span>
      </footer>
    </div>
  );
}

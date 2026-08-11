import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from './api';
import type { Dashboard, OperatorConsultation, PendingDelegation, Session } from './api';

type View = 'dashboard' | 'consultations' | 'consent';

const dateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const statusLabels: Record<string, string> = {
  RESERVED: 'Reserved',
  DOCUMENTING: 'Documenting',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
  CANCELLED: 'Cancelled',
};

function percent(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.';
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
  const total = totalCounts(data.counts);
  const statuses = ['RESERVED', 'DOCUMENTING', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const;

  return (
    <>
      <section className="operator-metric-grid" aria-label="Consultation metrics">
        <article>
          <span>Total consultations</span>
          <strong>{total}</strong>
          <small>All recorded appointments</small>
        </article>
        <article>
          <span>Completion rate</span>
          <strong>{percent(data.completionRate)}</strong>
          <small>Completed consultations</small>
        </article>
        <article>
          <span>No-show rate</span>
          <strong>{percent(data.noShowRate)}</strong>
          <small>Appointments missed</small>
        </article>
        <article>
          <span>Upcoming</span>
          <strong>{data.counts.RESERVED ?? 0}</strong>
          <small>Currently reserved</small>
        </article>
      </section>

      <div className="operator-dashboard-grid">
        <section className="operator-card" aria-labelledby="status-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Service overview</p>
              <h2 id="status-title">Consultation status</h2>
            </div>
          </div>
          <div className="status-bars">
            {statuses.map((status) => {
              const count = data.counts[status] ?? 0;
              const width = total ? (count / total) * 100 : 0;
              return (
                <div key={status}>
                  <span>{statusLabels[status]}</span>
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
          <p className="eyebrow">Daily control</p>
          <h2 id="batch-title">No-show processing</h2>
          <p>Mark overdue reserved consultations as no-shows. This operation is safe to run more than once.</p>
          <button className="button button--secondary" onClick={onRunBatch} disabled={runningBatch}>
            {runningBatch ? 'Processing…' : 'Run no-show check'}
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
            <p className="eyebrow">Team performance</p>
            <h2 id="advisor-title">Advisor activity</h2>
          </div>
        </div>
        <div className="operator-table-wrap">
          <table className="advisor-performance">
            <thead>
              <tr>
                <th>Advisor</th>
                <th>State</th>
                <th>Reserved</th>
                <th>Completed</th>
                <th>Completion</th>
                <th>No-show</th>
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
                      {advisor.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{advisor.counts.RESERVED ?? 0}</td>
                  <td>{advisor.counts.COMPLETED ?? 0}</td>
                  <td>{percent(advisor.completionRate)}</td>
                  <td>{percent(advisor.noShowRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.advisorStatistics.length && <p className="operator-empty-copy">No advisor activity is available yet.</p>}
      </section>

      <section className="operator-card" aria-labelledby="products-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Customer interest</p>
            <h2 id="products-title">Interested products</h2>
          </div>
        </div>
        <div className="product-rankings">
          {data.interestedProducts.map(({ product, count }, index) => (
            <div key={product.id}>
              <span>{index + 1}</span>
              <div>
                <strong>{product.name}</strong>
                <small>{product.category || 'Uncategorized'}</small>
              </div>
              <b>{count}</b>
            </div>
          ))}
          {!data.interestedProducts.length && (
            <p className="operator-empty-copy">No products have been recorded yet.</p>
          )}
        </div>
      </section>
    </>
  );
}

function ConsultationDetail({ consultation }: { consultation: OperatorConsultation | null }) {
  if (!consultation)
    return (
      <section className="operator-card operator-detail operator-detail--empty">
        <span aria-hidden="true">↗</span>
        <h2>Select a consultation</h2>
        <p>Choose an appointment to inspect its operational record.</p>
      </section>
    );
  return (
    <section className="operator-card operator-detail" aria-live="polite">
      <div className="operator-detail-head">
        <div>
          <p className="eyebrow">Consultation record</p>
          <h2>{consultation.testResult.testType.name}</h2>
        </div>
        <span className={`status status--${consultation.status.toLowerCase()}`}>
          {statusLabels[consultation.status]}
        </span>
      </div>
      <dl>
        <div>
          <dt>Scheduled</dt>
          <dd>{dateTime.format(new Date(consultation.scheduledStartAt))}</dd>
        </div>
        <div>
          <dt>Examinee</dt>
          <dd>{consultation.testResult.examinee.name}</dd>
        </div>
        <div>
          <dt>Requester</dt>
          <dd>
            {consultation.requester.name}
            <small>{consultation.requester.email}</small>
          </dd>
        </div>
        <div>
          <dt>Advisor</dt>
          <dd>
            {consultation.advisor.user.name}
            <small>{consultation.advisor.user.email}</small>
          </dd>
        </div>
        <div>
          <dt>Consent</dt>
          <dd>
            {consultation.delegation
              ? `${consultation.delegation.status} · ${consultation.delegation.consentMethod ?? 'Pending method'}`
              : 'Direct access'}
          </dd>
        </div>
        <div>
          <dt>Result date</dt>
          <dd>{dateTime.format(new Date(consultation.testResult.testedAt))}</dd>
        </div>
      </dl>
      <div className="operator-record">
        <h3>Consultation notes</h3>
        {consultation.record ? (
          <>
            <p>{consultation.record.summary || 'No summary entered.'}</p>
            <div className="record-products">
              {consultation.record.interestedProducts.map(({ product }) => (
                <span key={product.id}>{product.name}</span>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">No consultation record has been started.</p>
        )}
      </div>
    </section>
  );
}

function ConsultationsView({ consultations }: { consultations: OperatorConsultation[] }) {
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
            <p className="eyebrow">Operations log</p>
            <h2 id="consultations-title">All consultations</h2>
          </div>
          <select
            className="filter-select"
            aria-label="Filter by status"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
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
              <span className="operator-list-date">{dateTime.format(new Date(item.scheduledStartAt))}</span>
              <strong>{item.testResult.testType.name}</strong>
              <small>
                {item.testResult.examinee.name} · {item.advisor.user.name}
              </small>
              <span className={`status status--${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span>
            </button>
          ))}
          {!filtered.length && <p className="operator-empty-copy">No consultations match this filter.</p>}
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
  return (
    <section className="operator-card consent-queue" aria-labelledby="consent-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Access governance</p>
          <h2 id="consent-title">External consent queue</h2>
        </div>
        <strong className="consent-summary">{pending.length} pending</strong>
      </div>
      <div className="legal-note">
        <span aria-hidden="true">!</span>
        <p>
          <strong>Verify only after completing the lawful external process.</strong> Approval grants the delegate access
          to the examinee’s test result.
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
              <span>Requests access to</span>
              <strong>
                {item.testResult.examinee.name} · {item.testResult.testType.name}
              </strong>
              <small>Submitted {dateTime.format(new Date(item.createdAt))}</small>
            </div>
            <button
              className="button button--primary"
              disabled={verifyingId === item.id}
              onClick={() => onVerify(item.id)}
            >
              {verifyingId === item.id ? 'Verifying…' : 'Verify consent'}
            </button>
          </article>
        ))}
        {!pending.length && (
          <div className="operator-empty-copy">
            <strong>Queue clear</strong>
            <p>There are no external consent requests awaiting verification.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function OperatorPortal({ session, onLogout }: { session: Session; onLogout: () => void }) {
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
      else setError(messageFor(nextError));
    } finally {
      setLoading(false);
    }
  }, [onLogout, session.accessToken]);

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
        else setError(messageFor(nextError));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [onLogout, session.accessToken]);

  async function runBatch() {
    setRunningBatch(true);
    setBatchNotice('');
    try {
      const result = await api.runNoShowBatch(session.accessToken);
      setBatchNotice(`${result.count} consultation${result.count === 1 ? '' : 's'} marked as no-show.`);
      await load();
    } catch (nextError) {
      setBatchNotice(messageFor(nextError));
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
      else setError(messageFor(nextError));
    } finally {
      setVerifyingId('');
    }
  }

  return (
    <div className="portal-shell operator-shell">
      <header className="portal-header">
        <a className="brand" href="/" aria-label="Alostar operator home">
          <span className="brand-mark" aria-hidden="true">
            a
          </span>
          <span>
            alostar <em>operations</em>
          </span>
        </a>
        <nav aria-label="Operator navigation">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
            Dashboard
          </button>
          <button className={view === 'consultations' ? 'active' : ''} onClick={() => setView('consultations')}>
            Consultations
          </button>
          <button className={view === 'consent' ? 'active' : ''} onClick={() => setView('consent')}>
            Consent {pending.length > 0 && <span className="nav-count">{pending.length}</span>}
          </button>
        </nav>
        <div className="account-menu">
          <span className="avatar" aria-hidden="true">
            {session.user.name.charAt(0)}
          </span>
          <div>
            <strong>{session.user.name}</strong>
            <small>Operator</small>
          </div>
          <button type="button" className="text-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="portal-main operator-main">
        <div className="page-intro">
          <div>
            <p className="eyebrow">Operations center</p>
            <h1>
              {view === 'dashboard'
                ? 'Service at a glance'
                : view === 'consultations'
                  ? 'Consultation oversight'
                  : 'Consent verification'}
            </h1>
            <p>
              {view === 'dashboard'
                ? 'Monitor service health, advisor activity, and customer interest.'
                : view === 'consultations'
                  ? 'Review every consultation and its operational context.'
                  : 'Review externally confirmed consent before granting access.'}
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
            <span className="spinner" /> Loading operations workspace…
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
        <span>Alostar operations center</span>
        <span>Business timezone: Asia/Seoul</span>
      </footer>
    </div>
  );
}

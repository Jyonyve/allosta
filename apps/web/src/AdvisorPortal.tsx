import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, api } from './api';
import type { AdvisorAvailability, AdvisorConsultation, AdvisorProfile, Product, RecordInput, Session } from './api';

const KST = 'Asia/Seoul';
const dateFormatter = new Intl.DateTimeFormat('en-US', {
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function kstParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

function kstInputToIso(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute)).toISOString();
}

function tomorrowKst() {
  const tomorrow = new Date(Date.now() + 86_400_000);
  return kstParts(tomorrow).date;
}

function overlaps(start: number, end: number, item: AdvisorAvailability) {
  return start < new Date(item.endsAt).getTime() && end > new Date(item.startsAt).getTime();
}

function AvailabilityView({
  token,
  availability,
  onChanged,
  onUnauthorized,
}: {
  token: string;
  availability: AdvisorAvailability[];
  onChanged: () => Promise<void>;
  onUnauthorized: () => void;
}) {
  const [editingId, setEditingId] = useState('');
  const [date, setDate] = useState(() => tomorrowKst());
  const [startsAt, setStartsAt] = useState('11:00');
  const [endsAt, setEndsAt] = useState('14:00');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  function reset() {
    setEditingId('');
    setDate(tomorrowKst());
    setStartsAt('11:00');
    setEndsAt('14:00');
  }

  function edit(item: AdvisorAvailability) {
    const start = kstParts(item.startsAt);
    const end = kstParts(item.endsAt);
    setEditingId(item.id);
    setDate(start.date);
    setStartsAt(start.time);
    setEndsAt(end.time);
    setNotice(null);
    document.getElementById('availability-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    const start = new Date(kstInputToIso(date, startsAt));
    const end = new Date(kstInputToIso(date, endsAt));
    if (!(start < end)) {
      setNotice({ kind: 'error', text: 'End time must be later than start time on the same date.' });
      return;
    }
    if (availability.some((item) => item.id !== editingId && overlaps(start.getTime(), end.getTime(), item))) {
      setNotice({ kind: 'error', text: 'This range overlaps availability you already registered.' });
      return;
    }
    setBusy(true);
    try {
      if (editingId) await api.updateAvailability(token, editingId, start.toISOString(), end.toISOString());
      else await api.createAvailability(token, start.toISOString(), end.toISOString());
      await onChanged();
      setNotice({ kind: 'success', text: editingId ? 'Availability updated.' : 'Availability added.' });
      reset();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onUnauthorized();
      else setNotice({ kind: 'error', text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: AdvisorAvailability) {
    if (!window.confirm(`Delete availability on ${dateFormatter.format(new Date(item.startsAt))}?`)) return;
    setDeletingId(item.id);
    setNotice(null);
    try {
      await api.deleteAvailability(token, item.id);
      await onChanged();
      if (editingId === item.id) reset();
      setNotice({ kind: 'success', text: 'Availability deleted.' });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onUnauthorized();
      else setNotice({ kind: 'error', text: errorMessage(error) });
    } finally {
      setDeletingId('');
    }
  }

  const grouped = useMemo(() => {
    const groups = new Map<string, AdvisorAvailability[]>();
    for (const item of availability) {
      const key = kstParts(item.startsAt).date;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()];
  }, [availability]);

  return (
    <div className="advisor-availability-layout">
      <section className="advisor-card availability-list-card" aria-labelledby="availability-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Consulting hours</p>
            <h2 id="availability-title">Your availability</h2>
          </div>
          <span className="count-pill">{availability.length} ranges</span>
        </div>
        {grouped.length ? (
          <div className="availability-days">
            {grouped.map(([key, items]) => (
              <section className="availability-day" key={key}>
                <div className="availability-date">
                  <strong>{dateFormatter.format(new Date(items[0].startsAt))}</strong>
                  <span>{fullDateFormatter.format(new Date(items[0].startsAt))}</span>
                </div>
                <div className="availability-ranges">
                  {items.map((item) => (
                    <div className="availability-range" key={item.id}>
                      <span aria-hidden="true">◷</span>
                      <strong>
                        {timeFormatter.format(new Date(item.startsAt))}–{timeFormatter.format(new Date(item.endsAt))}
                      </strong>
                      <div>
                        <button type="button" onClick={() => edit(item)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-link"
                          disabled={deletingId === item.id}
                          onClick={() => remove(item)}
                        >
                          {deletingId === item.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="no-slots">
            <span aria-hidden="true">◷</span>
            <h3>No availability registered</h3>
            <p>Add your first date and time range using the form.</p>
          </div>
        )}
      </section>

      <section
        className="advisor-card availability-form-card"
        id="availability-form"
        aria-labelledby="availability-form-title"
      >
        <p className="step-label">{editingId ? 'Editing range' : 'New range'}</p>
        <h2 id="availability-form-title">{editingId ? 'Update availability' : 'Add availability'}</h2>
        <p className="muted">Add one or more ranges for a date. Adjacent ranges are allowed.</p>
        <form className="availability-form" onSubmit={submit}>
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <div className="time-input-row">
            <label>
              Start time
              <input
                type="time"
                step="1800"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </label>
            <label>
              End time
              <input
                type="time"
                step="1800"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                required
              />
            </label>
          </div>
          {notice && (
            <p className={`notice notice--${notice.kind}`} role="status">
              {notice.text}
            </p>
          )}
          <div className="form-actions">
            {editingId && (
              <button className="button button--secondary" type="button" onClick={reset}>
                Cancel edit
              </button>
            )}
            <button className="button button--primary" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Update range' : 'Add range'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

const advisorStatus: Record<AdvisorConsultation['status'], string> = {
  RESERVED: 'Reserved',
  DOCUMENTING: 'Draft started',
  COMPLETED: 'Completed',
  NO_SHOW: 'No show',
  CANCELLED: 'Cancelled',
};

function RecordEditor({
  token,
  consultation,
  products,
  onUpdated,
  onUnauthorized,
}: {
  token: string;
  consultation: AdvisorConsultation;
  products: Product[];
  onUpdated: () => Promise<void>;
  onUnauthorized: () => void;
}) {
  const record = consultation.record;
  const final = record?.status === 'FINAL';
  const editable = consultation.status === 'RESERVED' || consultation.status === 'DOCUMENTING';
  const [mainQuestion, setMainQuestion] = useState(record?.mainQuestion ?? '');
  const [summary, setSummary] = useState(record?.summary ?? '');
  const [memo, setMemo] = useState(record?.memo ?? '');
  const [followUpRequired, setFollowUpRequired] = useState(record?.followUpRequired ?? false);
  const [followUpNote, setFollowUpNote] = useState(record?.followUpNote ?? '');
  const [productIds, setProductIds] = useState(() => record?.interestedProducts.map((item) => item.product.id) ?? []);
  const [busy, setBusy] = useState<'draft' | 'final' | ''>('');
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const input: RecordInput = {
    mainQuestion: mainQuestion || undefined,
    summary: summary || undefined,
    memo: memo || undefined,
    followUpRequired,
    followUpNote: followUpRequired ? followUpNote || undefined : undefined,
    productIds,
  };

  async function save(finalize: boolean) {
    if (finalize && !summary.trim()) {
      setNotice({ kind: 'error', text: 'Add a consultation summary before finalizing.' });
      return;
    }
    if (finalize && !window.confirm('Finalize this record? Final records cannot be edited.')) return;
    setBusy(finalize ? 'final' : 'draft');
    setNotice(null);
    try {
      if (finalize) await api.finalizeRecord(token, consultation.id, input);
      else await api.saveDraft(token, consultation.id, input);
      await onUpdated();
      setNotice({ kind: 'success', text: finalize ? 'Record finalized and consultation completed.' : 'Draft saved.' });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onUnauthorized();
      else setNotice({ kind: 'error', text: errorMessage(error) });
    } finally {
      setBusy('');
    }
  }

  if (!editable && !final) {
    return (
      <div className="record-locked">
        <span aria-hidden="true">—</span>
        <p>A record cannot be created for this consultation status.</p>
      </div>
    );
  }

  return (
    <section className="record-editor" aria-labelledby="record-title">
      <div className="record-heading">
        <div>
          <p className="step-label">Consultation record</p>
          <h3 id="record-title">{final ? 'Final record' : record ? 'Continue draft' : 'Start documentation'}</h3>
        </div>
        {record && <span className={`status status--${record.status.toLowerCase()}`}>{record.status}</span>}
      </div>
      <fieldset disabled={final || Boolean(busy)}>
        <label>
          Main question
          <textarea
            rows={2}
            value={mainQuestion}
            onChange={(event) => setMainQuestion(event.target.value)}
            placeholder="What did the customer want to understand?"
          />
        </label>
        <label>
          Consultation summary
          <textarea
            rows={4}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Summarize the conversation and guidance provided."
          />
        </label>
        <label>
          Advisor memo
          <textarea
            rows={3}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="Internal notes for this consultation"
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={followUpRequired}
            onChange={(event) => setFollowUpRequired(event.target.checked)}
          />
          <span>
            <strong>Follow-up required</strong>
            <small>Flag this consultation for another contact.</small>
          </span>
        </label>
        {followUpRequired && (
          <label>
            Follow-up note
            <textarea
              rows={2}
              value={followUpNote}
              onChange={(event) => setFollowUpNote(event.target.value)}
              placeholder="What should happen next?"
            />
          </label>
        )}
        <div className="product-fieldset">
          <span>Interested products</span>
          <p>Select products the customer expressed interest in. This does not create an order.</p>
          <div className="product-options">
            {products.map((product) => (
              <label key={product.id} className={productIds.includes(product.id) ? 'selected' : ''}>
                <input
                  type="checkbox"
                  checked={productIds.includes(product.id)}
                  onChange={(event) =>
                    setProductIds((current) =>
                      event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id),
                    )
                  }
                />
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.category ?? 'Product'}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>
      {notice && (
        <p className={`notice notice--${notice.kind}`} role="status">
          {notice.text}
        </p>
      )}
      {!final && (
        <div className="record-actions">
          <button
            type="button"
            className="button button--secondary"
            disabled={Boolean(busy)}
            onClick={() => save(false)}
          >
            {busy === 'draft' ? 'Saving…' : 'Save draft'}
          </button>
          <button type="button" className="button button--primary" disabled={Boolean(busy)} onClick={() => save(true)}>
            {busy === 'final' ? 'Finalizing…' : 'Finalize & complete'}
          </button>
        </div>
      )}
    </section>
  );
}

function ScheduleView({
  token,
  consultations,
  products,
  onUpdated,
  onUnauthorized,
}: {
  token: string;
  consultations: AdvisorConsultation[];
  products: Product[];
  onUpdated: () => Promise<void>;
  onUnauthorized: () => void;
}) {
  const [selectedId, setSelectedId] = useState(consultations[0]?.id ?? '');
  const selected = consultations.find((item) => item.id === selectedId) ?? consultations[0];

  if (!consultations.length)
    return (
      <section className="empty-state">
        <span aria-hidden="true">◇</span>
        <h2>No consultations assigned</h2>
        <p>New reservations assigned to you will appear here.</p>
      </section>
    );

  return (
    <div className="advisor-schedule-layout">
      <section className="advisor-card schedule-list" aria-labelledby="schedule-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Assigned to you</p>
            <h2 id="schedule-title">Consultations</h2>
          </div>
          <span className="count-pill">{consultations.length}</span>
        </div>
        <div className="advisor-appointment-list">
          {consultations.map((item) => (
            <button
              type="button"
              key={item.id}
              className={selected?.id === item.id ? 'selected' : ''}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="appointment-date">
                <strong>{timeFormatter.format(new Date(item.scheduledStartAt))}</strong>
                <small>{dateFormatter.format(new Date(item.scheduledStartAt))}</small>
              </span>
              <span className="appointment-person">
                <strong>{item.testResult.examinee.name}</strong>
                <small>{item.testResult.testType.name}</small>
              </span>
              <span className={`status status--${item.status.toLowerCase()}`}>{advisorStatus[item.status]}</span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <div className="advisor-detail-column">
          <section className="advisor-card consultation-overview">
            <div className="overview-top">
              <div>
                <p className="eyebrow">Consultation detail</p>
                <h2>{selected.testResult.examinee.name}</h2>
              </div>
              <span className={`status status--${selected.status.toLowerCase()}`}>
                {advisorStatus[selected.status]}
              </span>
            </div>
            <dl>
              <div>
                <dt>Scheduled</dt>
                <dd>
                  {dateFormatter.format(new Date(selected.scheduledStartAt))} ·{' '}
                  {timeFormatter.format(new Date(selected.scheduledStartAt))}
                </dd>
              </div>
              <div>
                <dt>Requester</dt>
                <dd>{selected.requester.name}</dd>
              </div>
              <div>
                <dt>Test type</dt>
                <dd>{selected.testResult.testType.name}</dd>
              </div>
              <div>
                <dt>Tested</dt>
                <dd>{fullDateFormatter.format(new Date(selected.testResult.testedAt))}</dd>
              </div>
            </dl>
            {selected.testResult.summary && (
              <div className="health-result-note">
                <strong>Test result note</strong>
                <p>{selected.testResult.summary}</p>
              </div>
            )}
          </section>
          <RecordEditor
            key={selected.id}
            token={token}
            consultation={selected}
            products={products}
            onUpdated={onUpdated}
            onUnauthorized={onUnauthorized}
          />
        </div>
      )}
    </div>
  );
}

export function AdvisorPortal({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [view, setView] = useState<'schedule' | 'availability'>('schedule');
  const [profile, setProfile] = useState<AdvisorProfile | null>(null);
  const [availability, setAvailability] = useState<AdvisorAvailability[]>([]);
  const [consultations, setConsultations] = useState<AdvisorConsultation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now] = useState(() => Date.now());

  const onUnauthorized = useCallback(() => onLogout(), [onLogout]);
  const loadAvailability = useCallback(
    async () => setAvailability(await api.advisorAvailability(session.accessToken)),
    [session.accessToken],
  );
  const loadConsultations = useCallback(
    async () => setConsultations(await api.advisorConsultations(session.accessToken)),
    [session.accessToken],
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      api.advisorProfile(session.accessToken),
      api.advisorAvailability(session.accessToken),
      api.advisorConsultations(session.accessToken),
      api.products(session.accessToken),
    ])
      .then(([nextProfile, nextAvailability, nextConsultations, nextProducts]) => {
        if (!active) return;
        setProfile(nextProfile);
        setAvailability(nextAvailability);
        setConsultations(nextConsultations);
        setProducts(nextProducts);
      })
      .catch((nextError: unknown) => {
        if (!active) return;
        if (nextError instanceof ApiError && nextError.status === 401) onUnauthorized();
        else setError(errorMessage(nextError));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [onUnauthorized, session.accessToken]);

  const upcoming = consultations.filter(
    (item) => item.status === 'RESERVED' && new Date(item.scheduledStartAt).getTime() > now,
  ).length;
  const drafts = consultations.filter((item) => item.status === 'DOCUMENTING').length;

  return (
    <div className="portal-shell advisor-shell">
      <header className="portal-header">
        <a className="brand" href="/" aria-label="Alostar advisor portal">
          <span className="brand-mark" aria-hidden="true">
            a
          </span>
          <span>alostar</span>
          <em>Advisor</em>
        </a>
        <nav aria-label="Advisor portal">
          <button className={view === 'schedule' ? 'active' : ''} onClick={() => setView('schedule')}>
            Schedule
          </button>
          <button className={view === 'availability' ? 'active' : ''} onClick={() => setView('availability')}>
            Availability
          </button>
        </nav>
        <div className="account-menu">
          <span className="avatar" aria-hidden="true">
            {session.user.name.charAt(0).toUpperCase()}
          </span>
          <span className="account-copy">
            <strong>{session.user.name}</strong>
            <small>{profile?.active === false ? 'Inactive advisor' : 'Active advisor'}</small>
          </span>
          <button type="button" className="logout-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="portal-main advisor-main">
        <div className="page-intro advisor-intro">
          <div>
            <p className="eyebrow">Advisor workspace</p>
            <h1>{view === 'schedule' ? 'Consultation schedule' : 'Set your availability'}</h1>
            <p>
              {view === 'schedule'
                ? 'Review assigned consultations and document each conversation.'
                : 'Register the date and time ranges when you can consult.'}
            </p>
          </div>
          {view === 'schedule' && (
            <div className="advisor-metrics">
              <div>
                <strong>{upcoming}</strong>
                <span>Upcoming</span>
              </div>
              <div>
                <strong>{drafts}</strong>
                <span>Drafts</span>
              </div>
              <div>
                <strong>{profile?.testTypes.length ?? 0}</strong>
                <span>Test types</span>
              </div>
            </div>
          )}
        </div>
        {profile && (
          <div className="advisor-specialties" aria-label="Supported test types">
            <span>Consulting specialties</span>
            {profile.testTypes.map(({ testType }) => (
              <strong key={testType.id}>{testType.name}</strong>
            ))}
          </div>
        )}
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="page-loading" role="status">
            <span className="spinner" /> Loading advisor workspace…
          </div>
        ) : view === 'schedule' ? (
          <ScheduleView
            token={session.accessToken}
            consultations={consultations}
            products={products}
            onUpdated={loadConsultations}
            onUnauthorized={onUnauthorized}
          />
        ) : (
          <AvailabilityView
            token={session.accessToken}
            availability={availability}
            onChanged={loadAvailability}
            onUnauthorized={onUnauthorized}
          />
        )}
      </main>
      <footer>
        <span>Alostar advisor services</span>
        <span>Business timezone: Asia/Seoul</span>
      </footer>
    </div>
  );
}

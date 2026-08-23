import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { AdvisorAvailability, AdvisorConsultation, Product, RecordInput, Session } from './api';
import { LanguageSwitcher, useI18n } from './i18n';
import { firstDisplayableError, isUnauthorized, queryKeys, useUnauthorizedHandler } from './queries';

const KST = 'Asia/Seoul';
function errorMessage(error: unknown, t: (key: string) => string) {
  return t(error instanceof Error ? error.message : 'The request could not be completed.');
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
  advisorUserId,
  availability,
  onUnauthorized,
}: {
  token: string;
  advisorUserId: string;
  availability: AdvisorAvailability[];
  onUnauthorized: () => void;
}) {
  const { t, formatDate } = useI18n();
  const queryClient = useQueryClient();
  const invalidateAvailability = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.advisorAvailability(advisorUserId) });

  const saveMutation = useMutation({
    mutationFn: ({ id, startsAt, endsAt }: { id: string; startsAt: string; endsAt: string }) =>
      id ? api.updateAvailability(token, id, startsAt, endsAt) : api.createAvailability(token, startsAt, endsAt),
    onSuccess: invalidateAvailability,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAvailability(token, id),
    onSuccess: invalidateAvailability,
  });

  const [editingId, setEditingId] = useState('');
  const [date, setDate] = useState(() => tomorrowKst());
  const [startsAt, setStartsAt] = useState('11:00');
  const [endsAt, setEndsAt] = useState('14:00');
  const [deletingId, setDeletingId] = useState('');
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const busy = saveMutation.isPending;

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
      setNotice({ kind: 'error', text: t('End time must be later than start time on the same date.') });
      return;
    }
    if (availability.some((item) => item.id !== editingId && overlaps(start.getTime(), end.getTime(), item))) {
      setNotice({ kind: 'error', text: t('This range overlaps availability you already registered.') });
      return;
    }
    try {
      await saveMutation.mutateAsync({
        id: editingId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      });
      setNotice({ kind: 'success', text: editingId ? t('Availability updated.') : t('Availability added.') });
      reset();
    } catch (error) {
      if (isUnauthorized(error)) onUnauthorized();
      else setNotice({ kind: 'error', text: errorMessage(error, t) });
    }
  }

  async function remove(item: AdvisorAvailability) {
    if (
      !window.confirm(
        t('Delete availability on {date}?', {
          date: formatDate(item.startsAt, { weekday: 'short', month: 'short', day: 'numeric' }),
        }),
      )
    )
      return;
    setDeletingId(item.id);
    setNotice(null);
    try {
      await deleteMutation.mutateAsync(item.id);
      if (editingId === item.id) reset();
      setNotice({ kind: 'success', text: t('Availability deleted.') });
    } catch (error) {
      if (isUnauthorized(error)) onUnauthorized();
      else setNotice({ kind: 'error', text: errorMessage(error, t) });
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
            <p className="eyebrow">{t('Consulting hours')}</p>
            <h2 id="availability-title">{t('Your availability')}</h2>
          </div>
          <span className="count-pill">{t('{count} ranges', { count: availability.length })}</span>
        </div>
        {grouped.length ? (
          <div className="availability-days">
            {grouped.map(([key, items]) => (
              <section className="availability-day" key={key}>
                <div className="availability-date">
                  <strong>{formatDate(items[0].startsAt, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                  <span>{formatDate(items[0].startsAt, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="availability-ranges">
                  {items.map((item) => (
                    <div className="availability-range" key={item.id}>
                      <span aria-hidden="true">◷</span>
                      <strong>
                        {formatDate(item.startsAt, { hour: 'numeric', minute: '2-digit' })}–
                        {formatDate(item.endsAt, { hour: 'numeric', minute: '2-digit' })}
                      </strong>
                      <div>
                        <button type="button" onClick={() => edit(item)}>
                          {t('Edit')}
                        </button>
                        <button
                          type="button"
                          className="danger-link"
                          disabled={deletingId === item.id}
                          onClick={() => remove(item)}
                        >
                          {deletingId === item.id ? t('Deleting…') : t('Delete')}
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
            <h3>{t('No availability registered')}</h3>
            <p>{t('Add your first date and time range using the form.')}</p>
          </div>
        )}
      </section>

      <section
        className="advisor-card availability-form-card"
        id="availability-form"
        aria-labelledby="availability-form-title"
      >
        <p className="step-label">{editingId ? t('Editing range') : t('New range')}</p>
        <h2 id="availability-form-title">{editingId ? t('Update availability') : t('Add availability')}</h2>
        <p className="muted">{t('Add one or more ranges for a date. Adjacent ranges are allowed.')}</p>
        <form className="availability-form" onSubmit={submit}>
          <label>
            {t('Date')}
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <div className="time-input-row">
            <label>
              {t('Start time')}
              <input
                type="time"
                step="1800"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </label>
            <label>
              {t('End time')}
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
                {t('Cancel edit')}
              </button>
            )}
            <button className="button button--primary" disabled={busy}>
              {busy ? t('Saving…') : editingId ? t('Update range') : t('Add range')}
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
  NOT_ATTENDED: 'Not attended',
  CANCELLED: 'Cancelled',
};

function RecordEditor({
  token,
  advisorUserId,
  consultation,
  products,
  onUnauthorized,
}: {
  token: string;
  advisorUserId: string;
  consultation: AdvisorConsultation;
  products: Product[];
  onUnauthorized: () => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const record = consultation.record;
  const final = record?.status === 'FINAL';
  const editable = consultation.status === 'RESERVED' || consultation.status === 'DOCUMENTING';
  const [mainQuestion, setMainQuestion] = useState(record?.mainQuestion ?? '');
  const [summary, setSummary] = useState(record?.summary ?? '');
  const [memo, setMemo] = useState(record?.memo ?? '');
  const [followUpRequired, setFollowUpRequired] = useState(record?.followUpRequired ?? false);
  const [followUpNote, setFollowUpNote] = useState(record?.followUpNote ?? '');
  const [productIds, setProductIds] = useState(() => record?.interestedProducts.map((item) => item.product.id) ?? []);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const saveMutation = useMutation({
    mutationFn: ({ finalize, payload }: { finalize: boolean; payload: RecordInput }) =>
      finalize
        ? api.finalizeRecord(token, consultation.id, payload)
        : api.saveDraft(token, consultation.id, payload),
    // The consultation list carries the record and status, so refetching it delivers the latest record.
    onSuccess: (_data, { finalize }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.advisorConsultations(advisorUserId) });
      if (finalize) {
        // Finalizing completes the consultation, which changes operator reporting.
        queryClient.invalidateQueries({ queryKey: queryKeys.operatorDashboard() });
        queryClient.invalidateQueries({ queryKey: queryKeys.operatorConsultations() });
      }
    },
  });
  const busy: 'draft' | 'final' | '' = saveMutation.isPending
    ? saveMutation.variables.finalize
      ? 'final'
      : 'draft'
    : '';

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
      setNotice({ kind: 'error', text: t('Add a consultation summary before finalizing.') });
      return;
    }
    if (finalize && !window.confirm(t('Finalize this record? Final records cannot be edited.'))) return;
    setNotice(null);
    try {
      await saveMutation.mutateAsync({ finalize, payload: input });
      setNotice({
        kind: 'success',
        text: finalize ? t('Record finalized and consultation completed.') : t('Draft saved.'),
      });
    } catch (error) {
      if (isUnauthorized(error)) onUnauthorized();
      else setNotice({ kind: 'error', text: errorMessage(error, t) });
    }
  }

  if (!editable && !final) {
    return (
      <div className="record-locked">
        <span aria-hidden="true">—</span>
        <p>{t('A record cannot be created for this consultation status.')}</p>
      </div>
    );
  }

  return (
    <section className="record-editor" aria-labelledby="record-title">
      <div className="record-heading">
        <div>
          <p className="step-label">{t('Consultation record')}</p>
          <h3 id="record-title">
            {final ? t('Final record') : record ? t('Continue draft') : t('Start documentation')}
          </h3>
        </div>
        {record && <span className={`status status--${record.status.toLowerCase()}`}>{record.status}</span>}
      </div>
      <fieldset disabled={final || Boolean(busy)}>
        <label>
          {t('Main question')}
          <textarea
            rows={2}
            value={mainQuestion}
            onChange={(event) => setMainQuestion(event.target.value)}
            placeholder={t('What did the customer want to understand?')}
          />
        </label>
        <label>
          {t('Consultation summary')}
          <textarea
            rows={4}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={t('Summarize the conversation and guidance provided.')}
          />
        </label>
        <label>
          {t('Advisor memo')}
          <textarea
            rows={3}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder={t('Internal notes for this consultation')}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={followUpRequired}
            onChange={(event) => setFollowUpRequired(event.target.checked)}
          />
          <span>
            <strong>{t('Follow-up required')}</strong>
            <small>{t('Flag this consultation for another contact.')}</small>
          </span>
        </label>
        {followUpRequired && (
          <label>
            {t('Follow-up note')}
            <textarea
              rows={2}
              value={followUpNote}
              onChange={(event) => setFollowUpNote(event.target.value)}
              placeholder={t('What should happen next?')}
            />
          </label>
        )}
        <div className="product-fieldset">
          <span>{t('Interested products')}</span>
          <p>{t('Select products the customer expressed interest in. This does not create an order.')}</p>
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
                  <strong>{t(product.name)}</strong>
                  <small>{product.category ? t(product.category) : t('Product')}</small>
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
            {busy === 'draft' ? t('Saving…') : t('Save draft')}
          </button>
          <button type="button" className="button button--primary" disabled={Boolean(busy)} onClick={() => save(true)}>
            {busy === 'final' ? t('Finalizing…') : t('Finalize & complete')}
          </button>
        </div>
      )}
    </section>
  );
}

function ScheduleView({
  token,
  advisorUserId,
  consultations,
  products,
  onUnauthorized,
}: {
  token: string;
  advisorUserId: string;
  consultations: AdvisorConsultation[];
  products: Product[];
  onUnauthorized: () => void;
}) {
  const { t, formatDate } = useI18n();
  const [selectedId, setSelectedId] = useState(consultations[0]?.id ?? '');
  const selected = consultations.find((item) => item.id === selectedId) ?? consultations[0];

  if (!consultations.length)
    return (
      <section className="empty-state">
        <span aria-hidden="true">◇</span>
        <h2>{t('No consultations assigned')}</h2>
        <p>{t('New reservations assigned to you will appear here.')}</p>
      </section>
    );

  return (
    <div className="advisor-schedule-layout">
      <section className="advisor-card schedule-list" aria-labelledby="schedule-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('Assigned to you')}</p>
            <h2 id="schedule-title">{t('Consultations')}</h2>
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
                <strong>{formatDate(item.scheduledStartAt, { hour: 'numeric', minute: '2-digit' })}</strong>
                <small>{formatDate(item.scheduledStartAt, { weekday: 'short', month: 'short', day: 'numeric' })}</small>
              </span>
              <span className="appointment-person">
                <strong>{item.testResult.examinee.name}</strong>
                <small>{t(item.testResult.testType.name)}</small>
              </span>
              <span className={`status status--${item.status.toLowerCase()}`}>{t(advisorStatus[item.status])}</span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <div className="advisor-detail-column">
          <section className="advisor-card consultation-overview">
            <div className="overview-top">
              <div>
                <p className="eyebrow">{t('Consultation detail')}</p>
                <h2>{selected.testResult.examinee.name}</h2>
              </div>
              <span className={`status status--${selected.status.toLowerCase()}`}>
                {t(advisorStatus[selected.status])}
              </span>
            </div>
            <dl>
              <div>
                <dt>{t('Scheduled')}</dt>
                <dd>
                  {formatDate(selected.scheduledStartAt, { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
                  {formatDate(selected.scheduledStartAt, { hour: 'numeric', minute: '2-digit' })}
                </dd>
              </div>
              <div>
                <dt>{t('Requester')}</dt>
                <dd>{selected.requester.name}</dd>
              </div>
              <div>
                <dt>{t('Test type')}</dt>
                <dd>{t(selected.testResult.testType.name)}</dd>
              </div>
              <div>
                <dt>{t('Tested')}</dt>
                <dd>{formatDate(selected.testResult.testedAt, { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
              </div>
            </dl>
            {selected.testResult.summary && (
              <div className="health-result-note">
                <strong>{t('Test result note')}</strong>
                <p>{selected.testResult.summary}</p>
              </div>
            )}
          </section>
          <RecordEditor
            key={selected.id}
            token={token}
            advisorUserId={advisorUserId}
            consultation={selected}
            products={products}
            onUnauthorized={onUnauthorized}
          />
        </div>
      )}
    </div>
  );
}

export function AdvisorPortal({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { t } = useI18n();
  const token = session.accessToken;
  const advisorUserId = session.user.id;
  const [view, setView] = useState<'schedule' | 'availability'>('schedule');
  const [now] = useState(() => Date.now());

  const onUnauthorized = useCallback(() => onLogout(), [onLogout]);

  const profileQuery = useQuery({
    queryKey: queryKeys.advisorProfile(advisorUserId),
    queryFn: () => api.advisorProfile(token),
  });
  const availabilityQuery = useQuery({
    queryKey: queryKeys.advisorAvailability(advisorUserId),
    queryFn: () => api.advisorAvailability(token),
  });
  const consultationsQuery = useQuery({
    queryKey: queryKeys.advisorConsultations(advisorUserId),
    queryFn: () => api.advisorConsultations(token),
  });
  const productsQuery = useQuery({
    queryKey: queryKeys.products(),
    queryFn: () => api.products(token),
  });

  useUnauthorizedHandler(
    [profileQuery.error, availabilityQuery.error, consultationsQuery.error, productsQuery.error],
    onUnauthorized,
  );

  const profile = profileQuery.data ?? null;
  const availability: AdvisorAvailability[] = useMemo(() => availabilityQuery.data ?? [], [availabilityQuery.data]);
  const consultations: AdvisorConsultation[] = useMemo(
    () => consultationsQuery.data ?? [],
    [consultationsQuery.data],
  );
  const products: Product[] = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const loading =
    profileQuery.isPending || availabilityQuery.isPending || consultationsQuery.isPending || productsQuery.isPending;
  const loadError = firstDisplayableError(
    profileQuery.error,
    availabilityQuery.error,
    consultationsQuery.error,
    productsQuery.error,
  );
  const error = loadError ? errorMessage(loadError, t) : '';

  const upcoming = consultations.filter(
    (item) => item.status === 'RESERVED' && new Date(item.scheduledStartAt).getTime() > now,
  ).length;
  const drafts = consultations.filter((item) => item.status === 'DOCUMENTING').length;

  return (
    <div className="portal-shell advisor-shell">
      <header className="portal-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Allosta advisor portal">
          <span className="brand-mark" aria-hidden="true">
            a
          </span>
          <span>allosta</span>
          <em>{t('Advisor')}</em>
        </a>
        <nav aria-label={t('Advisor portal')}>
          <button className={view === 'schedule' ? 'active' : ''} onClick={() => setView('schedule')}>
            {t('Schedule')}
          </button>
          <button className={view === 'availability' ? 'active' : ''} onClick={() => setView('availability')}>
            {t('Availability')}
          </button>
        </nav>
        <div className="account-menu">
          <span className="avatar" aria-hidden="true">
            {session.user.name.charAt(0).toUpperCase()}
          </span>
          <span className="account-copy">
            <strong>{session.user.name}</strong>
            <small>{profile?.active === false ? t('Inactive advisor') : t('Active advisor')}</small>
          </span>
          <LanguageSwitcher />
          <button type="button" className="logout-button" onClick={onLogout}>
            {t('Log out')}
          </button>
        </div>
      </header>

      <main className="portal-main advisor-main">
        <div className="page-intro advisor-intro">
          <div>
            <p className="eyebrow">{t('Advisor workspace')}</p>
            <h1>{view === 'schedule' ? t('Consultation schedule') : t('Set your availability')}</h1>
            <p>
              {view === 'schedule'
                ? t('Review assigned consultations and document each conversation.')
                : t('Register the date and time ranges when you can consult.')}
            </p>
          </div>
          {view === 'schedule' && (
            <div className="advisor-metrics">
              <div>
                <strong>{upcoming}</strong>
                <span>{t('Upcoming')}</span>
              </div>
              <div>
                <strong>{drafts}</strong>
                <span>{t('Drafts')}</span>
              </div>
              <div>
                <strong>{profile?.testTypes.length ?? 0}</strong>
                <span>{t('Test types')}</span>
              </div>
            </div>
          )}
        </div>
        {profile && (
          <div className="advisor-specialties" aria-label={t('Supported test types')}>
            <span>{t('Consulting specialties')}</span>
            {profile.testTypes.map(({ testType }) => (
              <strong key={testType.id}>{t(testType.name)}</strong>
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
            <span className="spinner" /> {t('Loading advisor workspace…')}
          </div>
        ) : view === 'schedule' ? (
          <ScheduleView
            token={token}
            advisorUserId={advisorUserId}
            consultations={consultations}
            products={products}
            onUnauthorized={onUnauthorized}
          />
        ) : (
          <AvailabilityView
            token={token}
            advisorUserId={advisorUserId}
            availability={availability}
            onUnauthorized={onUnauthorized}
          />
        )}
      </main>
      <footer>
        <span>{t('Allosta advisor services')}</span>
        <span>{t('Business timezone: Asia/Seoul')}</span>
      </footer>
    </div>
  );
}

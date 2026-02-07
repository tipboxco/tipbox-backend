import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatsCard from '../../components/StatsCard';
import {
  fetchEvent,
  updateEvent,
  deleteEvent,
  fetchEventParticipants,
  fetchEventAnalytics,
  fetchEventBadges,
  addEventBadge,
  updateEventBadge,
  removeEventBadge,
  fetchEventRewards,
} from '../../api/admin-events';
import type {
  AdminEventDetailResponse,
  AdminEventParticipantListItem,
  AdminEventAnalyticsResponse,
  AdminEventBadgeListItem,
  AdminEventRewardListItem,
} from '../../types/admin';
import '../gamification/gamification.css';
import './events.css';

type TabId = 'summary' | 'badges' | 'participants' | 'analytics' | 'rewards';

function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<AdminEventDetailResponse | null>(null);
  const [tab, setTab] = useState<TabId>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetchEvent(id);
      if (res.data) setEvent(res.data);
      else setError('Event bulunamadı');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  if (!id) {
    return (
      <div className="event-detail-page">
        <p>Geçersiz event ID.</p>
        <Link to="/events" className="event-detail-back">
          <i className="fa-solid fa-arrow-left"></i> Listeye dön
        </Link>
      </div>
    );
  }

  if (loading || !event) {
    return (
      <div className="event-detail-page">
        <Link to="/events" className="event-detail-back">
          <i className="fa-solid fa-arrow-left"></i> Listeye dön
        </Link>
        {loading ? <LoadingSpinner /> : error ? <p className="events-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="event-detail-page">
      <Link to="/events" className="event-detail-back">
        <i className="fa-solid fa-arrow-left"></i> Listeye dön
      </Link>

      <div className="event-detail-header">
        <i className="fa-solid fa-calendar-check event-detail-title-icon" aria-hidden />
        <h1 className="event-detail-title">{event.title}</h1>
        <span className="event-detail-id">ID: {event.id}</span>
        <span
          className={`events-badge ${
            event.status === 'DRAFT'
              ? 'events-badge-draft'
              : event.status === 'PUBLISHED'
                ? 'events-badge-published'
                : 'events-badge-closed'
          }`}
        >
          {event.status}
        </span>
      </div>

      <div className="event-detail-tabs">
        {(
          [
            ['summary', 'Özet'],
            ['badges', "Badge'ler"],
            ['participants', 'Katılımcılar'],
            ['analytics', 'Analitik'],
            ['rewards', 'Ödüller'],
          ] as const
        ).map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            className={`event-detail-tab ${tab === tabId ? 'active' : ''}`}
            onClick={() => setTab(tabId)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <EventSummaryTab event={event} onUpdated={loadEvent} onDeleted={() => navigate('/events')} />
      )}
      {tab === 'badges' && <EventBadgesTab eventId={id} eventTitle={event.title} />}
      {tab === 'participants' && <EventParticipantsTab eventId={id} />}
      {tab === 'analytics' && <EventAnalyticsTab eventId={id} />}
      {tab === 'rewards' && <EventRewardsTab eventId={id} />}
    </div>
  );
}

function EventSummaryTab({
  event,
  onUpdated,
  onDeleted,
}: {
  event: AdminEventDetailResponse;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    title: event.title,
    description: event.description ?? '',
    startDate: event.startDate.slice(0, 16),
    endDate: event.endDate.slice(0, 16),
    status: event.status,
    feedType: event.feedType,
    imageUrl: event.imageUrl ?? '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateEvent(event.id, {
        title: form.title,
        description: form.description || null,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        status: form.status,
        feedType: form.feedType,
        imageUrl: form.imageUrl || null,
      });
      setEditing(false);
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteEvent(event.id);
      onDeleted();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DataCard title="Event bilgisi">
      {!editing ? (
        <>
          <div className="info-card-hero-event">
            <div className="info-card-visual-event">
              {event.imageUrl ? (
                <img src={event.imageUrl} alt={event.title} />
              ) : (
                <div className="info-card-image-placeholder">
                  <i className="fa-solid fa-calendar-days" aria-hidden />
                  <span>Event görseli yok</span>
                </div>
              )}
            </div>
            <div className="info-card-chips">
              <span
                className={`info-chip events-badge ${
                  event.status === 'DRAFT'
                    ? 'events-badge-draft'
                    : event.status === 'PUBLISHED'
                      ? 'events-badge-published'
                      : 'events-badge-closed'
                }`}
              >
                {event.status}
              </span>
              <span className="info-chip info-chip-feed">{event.feedType}</span>
            </div>
          </div>

          <div className="info-card-stats info-card-stats-event">
            <div className="info-stat-pill info-stat-pill-wide">
              <i className="fa-regular fa-calendar-check" aria-hidden />
              <div>
                <span className="info-stat-label">Başlangıç</span>
                <span className="info-stat-value">
                  {new Date(event.startDate).toLocaleString('tr-TR')}
                </span>
              </div>
            </div>
            <div className="info-stat-pill info-stat-pill-wide">
              <i className="fa-regular fa-calendar-xmark" aria-hidden />
              <div>
                <span className="info-stat-label">Bitiş</span>
                <span className="info-stat-value">
                  {new Date(event.endDate).toLocaleString('tr-TR')}
                </span>
              </div>
            </div>
          </div>

          {event.description && (
            <div className="info-description">
              <p>{event.description}</p>
            </div>
          )}

          {(event.product || event.brand) && (
            <div className="info-card-chips" style={{ marginBottom: 'var(--spacing-4)' }}>
              {event.product && (
                <span className="info-chip info-chip-link">
                  <i className="fa-solid fa-box" aria-hidden />
                  {event.product.name ?? event.productId}
                </span>
              )}
              {event.brand && (
                <span className="info-chip info-chip-type info-chip-brand">
                  <i className="fa-solid fa-tag" aria-hidden />
                  {event.brand.name ?? event.brandId}
                </span>
              )}
            </div>
          )}

          {event.imageUrl && (
            <div className="info-meta">
              <a
                href={event.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="info-meta-item info-meta-link"
              >
                <i className="fa-solid fa-external-link" aria-hidden />
                Görseli aç
              </a>
            </div>
          )}

          <div className="event-detail-actions">
            <Button variant="secondary" onClick={() => setEditing(true)}>Düzenle</Button>
            {!confirmDelete ? (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>Event sil</Button>
            ) : (
              <>
                <span className="event-detail-empty">Silmek istediğinize emin misiniz?</span>
                <Button variant="danger" disabled={deleting} onClick={handleDelete}>Evet, sil</Button>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Vazgeç</Button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="event-detail-form-row">
            <div className="event-detail-form-group">
              <label>Başlık</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="event-detail-form-group">
              <label>Açıklama</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="event-detail-form-group">
              <label>Başlangıç</label>
              <input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="event-detail-form-group">
              <label>Bitiş</label>
              <input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div className="event-detail-form-group">
              <label>Durum</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
            <div className="event-detail-form-group">
              <label>Feed türü</label>
              <select
                value={form.feedType}
                onChange={(e) => setForm((f) => ({ ...f, feedType: e.target.value }))}
              >
                <option value="PICKS">PICKS</option>
                <option value="ROASTS">ROASTS</option>
              </select>
            </div>
            <div className="event-detail-form-group">
              <label>Görsel URL</label>
              <input
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="event-detail-actions">
            <Button variant="primary" disabled={saving} onClick={handleSave}>Kaydet</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Vazgeç</Button>
          </div>
        </>
      )}
    </DataCard>
  );
}

function EventBadgesTab({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [list, setList] = useState<AdminEventBadgeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addBadgeId, setAddBadgeId] = useState('');
  const [addRank, setAddRank] = useState(0);
  const [addDisplayOrder, setAddDisplayOrder] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRank, setEditRank] = useState(0);
  const [editDisplayOrder, setEditDisplayOrder] = useState<number | ''>('');
  const [editEnabled, setEditEnabled] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetchEventBadges(eventId);
      setList(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!addBadgeId.trim()) return;
    setSubmitting(true);
    try {
      await addEventBadge(eventId, {
        badgeId: addBadgeId.trim(),
        rank: addRank,
        displayOrder: addDisplayOrder === '' ? undefined : addDisplayOrder,
      });
      setAddBadgeId('');
      setAddRank(list.length);
      setAddDisplayOrder('');
      setShowAdd(false);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (eventBadgeId: string) => {
    setSubmitting(true);
    try {
      await updateEventBadge(eventId, eventBadgeId, {
        rank: editRank,
        displayOrder: editDisplayOrder === '' ? null : editDisplayOrder,
        enabled: editEnabled,
      });
      setEditingId(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (eventBadgeId: string) => {
    if (!window.confirm("Bu badge event'ten kaldırılacak. Emin misiniz?")) return;
    try {
      await removeEventBadge(eventId, eventBadgeId);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Kaldırılamadı');
    }
  };

  return (
    <DataCard title="Event Badge'leri">
      <p className="event-detail-badge-context">
        Bu event: <strong>{eventTitle}</strong> (ID: {eventId})
      </p>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="event-detail-actions" style={{ marginBottom: '1rem' }}>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? 'İptal' : "Event'e badge ekle"}
            </Button>
          </div>
          {showAdd && (
            <div className="event-detail-section" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
              <div className="event-detail-form-row">
                <div className="event-detail-form-group">
                  <label>Badge ID (UUID)</label>
                  <input
                    value={addBadgeId}
                    onChange={(e) => setAddBadgeId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <div className="event-detail-form-group">
                  <label>Rank</label>
                  <input
                    type="number"
                    min={0}
                    value={addRank}
                    onChange={(e) => setAddRank(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div className="event-detail-form-group">
                  <label>Display order (opsiyonel)</label>
                  <input
                    type="number"
                    value={addDisplayOrder}
                    onChange={(e) => setAddDisplayOrder(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    placeholder="—"
                  />
                </div>
              </div>
              <Button variant="primary" size="sm" disabled={submitting} onClick={handleAdd}>Ekle</Button>
            </div>
          )}
          {list.length === 0 ? (
            <div className="event-detail-empty">
              Bu event'e henüz badge eklenmemiş. &quot;Event'e badge ekle&quot; ile ekleyin.
            </div>
          ) : (
            <div className="events-table-wrap">
              <table className="events-table">
                <thead>
                  <tr>
                    <th>Badge</th>
                    <th>Rank</th>
                    <th>Display order</th>
                    <th>Enabled</th>
                    <th>Oluşturulma</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.badgeImageUrl && (
                          <img src={row.badgeImageUrl} alt="" className="event-detail-badge-thumb" />
                        )}
                        {row.badgeName} <span className="event-detail-id">({row.badgeId.slice(0, 8)}…)</span>
                      </td>
                      <td>
                        {editingId === row.id ? (
                          <input
                            type="number"
                            min={0}
                            value={editRank}
                            onChange={(e) => setEditRank(parseInt(e.target.value, 10) || 0)}
                            style={{ width: 60 }}
                          />
                        ) : (
                          row.rank
                        )}
                      </td>
                      <td>
                        {editingId === row.id ? (
                          <input
                            type="number"
                            value={editDisplayOrder}
                            onChange={(e) => setEditDisplayOrder(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                            style={{ width: 60 }}
                          />
                        ) : (
                          row.displayOrder ?? '—'
                        )}
                      </td>
                      <td>
                        {editingId === row.id ? (
                          <input
                            type="checkbox"
                            checked={editEnabled}
                            onChange={(e) => setEditEnabled(e.target.checked)}
                          />
                        ) : (
                          row.enabled ? 'Evet' : 'Hayır'
                        )}
                      </td>
                      <td>{new Date(row.createdAt).toLocaleDateString('tr-TR')}</td>
                      <td>
                        {editingId === row.id ? (
                          <>
                            <Button size="sm" variant="primary" disabled={submitting} onClick={() => handleUpdate(row.id)}>Kaydet</Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>İptal</Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => { setEditingId(row.id); setEditRank(row.rank); setEditDisplayOrder(row.displayOrder ?? ''); setEditEnabled(row.enabled); }}>Düzenle</Button>
                            <Button size="sm" variant="danger" onClick={() => handleRemove(row.id)}>Kaldır</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </DataCard>
  );
}

function EventParticipantsTab({ eventId }: { eventId: string }) {
  const [list, setList] = useState<AdminEventParticipantListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchEventParticipants(eventId, {
          limit: 20,
          offset: pagination.offset,
          sort: 'eventPostsCount',
          order: 'desc',
        });
        if (!cancelled) {
          setList(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, pagination.offset]);

  return (
    <DataCard title="Katılımcılar">
      {loading ? (
        <LoadingSpinner />
      ) : list.length === 0 ? (
        <div className="event-detail-empty">Henüz katılımcı yok.</div>
      ) : (
        <>
          <div className="events-table-wrap">
            <table className="events-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Email</th>
                  <th>Post</th>
                  <th>Beğeni</th>
                  <th>Katılım</th>
                  <th>Yorum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>{row.userDisplayName ?? row.userId.slice(0, 8)}…</td>
                    <td>{row.userEmail ?? '—'}</td>
                    <td>{row.eventPostsCount}</td>
                    <td>{row.eventLikesReceived}</td>
                    <td>{row.totalParticipated}</td>
                    <td>{row.totalComments}</td>
                    <td>
                      <Link to={`/users/${row.userId}`} className="events-link">Kullanıcı</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="events-pagination">
            <span className="events-pagination-info">{pagination.total} kayıt</span>
            <div className="events-pagination-btns">
              <Button
                size="sm"
                variant="secondary"
                disabled={pagination.offset === 0}
                onClick={() => setPagination((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
              >
                Önceki
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pagination.offset + pagination.limit >= pagination.total}
                onClick={() => setPagination((p) => ({ ...p, offset: p.offset + p.limit }))}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </>
      )}
    </DataCard>
  );
}

function EventAnalyticsTab({ eventId }: { eventId: string }) {
  const [data, setData] = useState<AdminEventAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchEventAnalytics(eventId);
        if (!cancelled) setData(res.data ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="event-detail-empty">Analitik yüklenemedi.</div>;

  return (
    <DataCard title="Analitik özet">
      <div className="events-stats-grid">
        <StatsCard title="Katılımcı sayısı" value={data.participantCount} icon="fa-users" color="accent" />
        <StatsCard title="Toplam post" value={data.totalPosts} icon="fa-file-lines" color="neutral" />
        <StatsCard title="Verilen ödül" value={data.totalRewardsGranted} icon="fa-gift" color="success" />
        <StatsCard title="Badge sayısı" value={data.badgesCount} icon="fa-medal" color="neutral" />
      </div>
    </DataCard>
  );
}

function EventRewardsTab({ eventId }: { eventId: string }) {
  const [list, setList] = useState<AdminEventRewardListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchEventRewards(eventId, {
          limit: 20,
          offset: pagination.offset,
          sort: 'awardedAt',
          order: 'desc',
        });
        if (!cancelled) {
          setList(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, pagination.offset]);

  return (
    <DataCard title="Ödüller">
      {loading ? (
        <LoadingSpinner />
      ) : list.length === 0 ? (
        <div className="event-detail-empty">Henüz ödül kaydı yok.</div>
      ) : (
        <>
          <div className="events-table-wrap">
            <table className="events-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Email</th>
                  <th>Tür</th>
                  <th>Reward ID</th>
                  <th>Amount</th>
                  <th>Verilme</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>{row.userDisplayName ?? row.userId.slice(0, 8)}…</td>
                    <td>{row.userEmail ?? '—'}</td>
                    <td>{row.rewardType}</td>
                    <td>{row.rewardId}</td>
                    <td>{row.amount ?? '—'}</td>
                    <td>{new Date(row.awardedAt).toLocaleString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="events-pagination">
            <span className="events-pagination-info">{pagination.total} kayıt</span>
            <div className="events-pagination-btns">
              <Button
                size="sm"
                variant="secondary"
                disabled={pagination.offset === 0}
                onClick={() => setPagination((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
              >
                Önceki
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pagination.offset + pagination.limit >= pagination.total}
                onClick={() => setPagination((p) => ({ ...p, offset: p.offset + p.limit }))}
              >
                Sonraki
              </Button>
            </div>
          </div>
        </>
      )}
    </DataCard>
  );
}

export default EventDetail;

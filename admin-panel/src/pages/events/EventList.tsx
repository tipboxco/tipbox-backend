import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import StatsCard from '../../components/StatsCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { fetchEventsStats, fetchEvents } from '../../api/admin-events';
import type { AdminEventListItem, AdminEventStatsResponse } from '../../types/admin';
import './events.css';

const PAGE_SIZE = 20;

function EventList() {
  const [stats, setStats] = useState<AdminEventStatsResponse | null>(null);
  const [events, setEvents] = useState<AdminEventListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [feedType, setFeedType] = useState<string>('');
  const [sort, setSort] = useState<'createdAt' | 'startDate' | 'endDate' | 'title'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchEventsStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'İstatistikler yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    (async () => {
      try {
        const res = await fetchEvents({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          status: status || undefined,
          feedType: feedType || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setEvents(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, search, status, feedType, sort, order]);

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const statusBadgeClass = (s: string) => {
    if (s === 'DRAFT') return 'events-badge-draft';
    if (s === 'PUBLISHED') return 'events-badge-published';
    return 'events-badge-closed';
  };

  return (
    <div className="events-page">
      <PageHeader
        title="Events"
        description="Event listesi, filtreleme ve yönetim"
        icon="fa-calendar-check"
      />

      {error && (
        <div className="events-error">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        stats && (
          <div className="events-stats-grid">
            <StatsCard title="Toplam" value={stats.total} icon="fa-calendar-check" color="accent" />
            <StatsCard title="Taslak" value={stats.draft} icon="fa-file" color="neutral" />
            <StatsCard title="Yayında" value={stats.published} icon="fa-broadcast-tower" color="success" />
            <StatsCard title="Kapalı" value={stats.closed} icon="fa-archive" color="danger" />
          </div>
        )
      )}

      <DataCard
        title="Event listesi"
        action={
          <div className="events-filters">
            <input
              type="text"
              placeholder="Ara (başlık, açıklama)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="events-filter-input"
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="events-filter-select"
            >
              <option value="">Tüm durumlar</option>
              <option value="DRAFT">Taslak</option>
              <option value="PUBLISHED">Yayında</option>
              <option value="CLOSED">Kapalı</option>
            </select>
            <select
              value={feedType}
              onChange={(e) => {
                setFeedType(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="events-filter-select"
            >
              <option value="">Tüm feed türleri</option>
              <option value="PICKS">PICKS</option>
              <option value="ROASTS">ROASTS</option>
            </select>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'createdAt' | 'startDate' | 'endDate' | 'title');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="events-filter-select"
            >
              <option value="createdAt">Oluşturulma</option>
              <option value="startDate">Başlangıç</option>
              <option value="endDate">Bitiş</option>
              <option value="title">Başlık</option>
            </select>
            <select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value as 'asc' | 'desc');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="events-filter-select"
            >
              <option value="desc">Azalan</option>
              <option value="asc">Artan</option>
            </select>
          </div>
        }
      >
        {loadingList ? (
          <div className="events-loading">
            <LoadingSpinner />
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon="fa-calendar-check"
            title="Event bulunamadı"
            description="Filtreleri değiştirerek tekrar deneyin."
          />
        ) : (
          <>
            <div className="events-table-wrap">
              <table className="events-table">
                <thead>
                  <tr>
                    <th className="events-table-col-thumb">Görsel</th>
                    <th>Başlık</th>
                    <th>Durum</th>
                    <th>Feed</th>
                    <th>Başlangıç</th>
                    <th>Bitiş</th>
                    <th>Katılımcı</th>
                    <th>Oluşturulma</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td className="events-table-col-thumb">
                        {e.imageUrl ? (
                          <img
                            src={e.imageUrl}
                            alt=""
                            className="events-list-thumb"
                            loading="lazy"
                          />
                        ) : (
                          <span className="events-list-thumb-placeholder" aria-hidden>
                            <i className="fa-regular fa-image" />
                          </span>
                        )}
                      </td>
                      <td>{e.title}</td>
                      <td>
                        <span className={`events-badge ${statusBadgeClass(e.status)}`}>{e.status}</span>
                      </td>
                      <td>{e.feedType}</td>
                      <td>{e.startDate ? new Date(e.startDate).toLocaleDateString('tr-TR') : '—'}</td>
                      <td>{e.endDate ? new Date(e.endDate).toLocaleDateString('tr-TR') : '—'}</td>
                      <td>{e.participantsCount ?? 0}</td>
                      <td>{e.createdAt ? new Date(e.createdAt).toLocaleDateString('tr-TR') : '—'}</td>
                      <td>
                        <Link to={`/events/${e.id}`} className="events-link">
                          Detay
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="events-pagination">
              <span className="events-pagination-info">
                {pagination.total} kayıt, sayfa {currentPage} / {totalPages}
              </span>
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
    </div>
  );
}

export default EventList;

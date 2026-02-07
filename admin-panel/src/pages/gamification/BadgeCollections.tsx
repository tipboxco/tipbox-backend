import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import StatsCard from '../../components/StatsCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
  fetchCollectionsStats,
  fetchCollections,
} from '../../api/admin-badges-collections';
import type { AdminCollectionListItem, AdminCollectionStatsResponse } from '../../types/admin';
import './gamification.css';

const PAGE_SIZE = 20;

function BadgeCollections() {
  const [stats, setStats] = useState<AdminCollectionStatsResponse | null>(null);
  const [collections, setCollections] = useState<AdminCollectionListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'createdAt' | 'name'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCollectionsStats();
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
        const res = await fetchCollections({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setCollections(res.data ?? []);
          if (res.pagination) setPagination((prev) => ({ ...prev, ...res.pagination }));
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
  }, [pagination.offset, search, sort, order]);

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="gamification-page">
      <PageHeader
        title="Badge Collections"
        description="Koleksiyon listesi, filtreleme ve yönetim"
        icon="fa-folder-open"
      />

      {error && (
        <div className="gamification-error">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        stats && (
          <div className="gamification-stats-grid">
            <StatsCard title="Toplam koleksiyon" value={stats.total} icon="fa-folder-open" color="accent" />
          </div>
        )
      )}

      <DataCard
        title="Koleksiyon listesi"
        action={
          <div className="gamification-filters">
            <input
              type="text"
              placeholder="Ara (ad)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="gamification-filter-input"
            />
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'createdAt' | 'name');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="gamification-filter-select"
            >
              <option value="createdAt">Oluşturulma</option>
              <option value="name">Ad</option>
            </select>
            <select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value as 'asc' | 'desc');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="gamification-filter-select"
            >
              <option value="desc">Azalan</option>
              <option value="asc">Artan</option>
            </select>
          </div>
        }
      >
        {loadingList ? (
          <div className="gamification-loading">
            <LoadingSpinner />
          </div>
        ) : collections.length === 0 ? (
          <EmptyState
            icon="fa-folder-open"
            title="Koleksiyon bulunamadı"
            description="Filtreleri değiştirin veya yeni koleksiyon oluşturun."
          />
        ) : (
          <>
            <div className="gamification-table-wrap">
              <table className="gamification-table">
                <thead>
                  <tr>
                    <th>Ad</th>
                    <th>Kategori</th>
                    <th>Badge sayısı</th>
                    <th>Hedef sayısı</th>
                    <th>Oluşturulma</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.categoryName ?? c.categoryId}</td>
                      <td>{c.badgesCount}</td>
                      <td>{c.goalsCount ?? 0}</td>
                      <td>{new Date(c.createdAt).toLocaleString('tr-TR')}</td>
                      <td>
                        <Link to={`/gamification/collections/${c.id}`}>
                          <Button variant="secondary" size="sm">
                            Detay
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.total > pagination.limit && (
              <div className="gamification-pagination">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setPagination((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))
                  }
                >
                  Önceki
                </Button>
                <span className="gamification-pagination-info">
                  {currentPage} / {totalPages} (toplam {pagination.total})
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setPagination((p) => ({
                      ...p,
                      offset: Math.min(pagination.total, p.offset + p.limit),
                    }))
                  }
                >
                  Sonraki
                </Button>
              </div>
            )}
          </>
        )}
      </DataCard>
    </div>
  );
}

export default BadgeCollections;

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import StatsCard from '../../components/StatsCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
  fetchContentPostsStats,
  fetchContentPosts,
} from '../../api/admin-content';
import type {
  AdminContentPostsStatsResponse,
  AdminContentPostListItem,
} from '../../types/admin';
import './content.css';

const PAGE_SIZE = 20;

const POST_TYPES = [
  { value: '', label: 'Tüm türler' },
  { value: 'FREE', label: 'FREE' },
  { value: 'TIPS', label: 'TIPS' },
  { value: 'COMPARE', label: 'COMPARE' },
  { value: 'QUESTION', label: 'QUESTION' },
  { value: 'EXPERIENCE', label: 'EXPERIENCE' },
  { value: 'UPDATE', label: 'UPDATE' },
];

type SortField = 'createdAt' | 'likesCount' | 'commentsCount' | 'viewsCount' | 'title';

function ContentPosts() {
  const [stats, setStats] = useState<AdminContentPostsStatsResponse | null>(null);
  const [posts, setPosts] = useState<AdminContentPostListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const [sort, setSort] = useState<SortField>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchContentPostsStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'İstatistikler yüklenemedi');
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
        const res = await fetchContentPosts({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          type: type || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setPosts(res.data ?? []);
          if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, search, type, sort, order]);

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const typeBadgeClass = (t: string) => {
    const map: Record<string, string> = {
      FREE: 'content-badge-free',
      TIPS: 'content-badge-tips',
      EXPERIENCE: 'content-badge-experience',
      QUESTION: 'content-badge-question',
      COMPARE: 'content-badge-compare',
      UPDATE: 'content-badge-update',
    };
    return map[t] ?? 'content-badge-free';
  };

  const userDisplay = (p: AdminContentPostListItem) =>
    p.userDisplayName || p.userName || p.userId?.slice(0, 8) || '—';

  const titleDisplay = (p: AdminContentPostListItem) =>
    (p.title && p.title.trim()) || (p.bodyExcerpt && p.bodyExcerpt.trim().slice(0, 80)) || '—';

  return (
    <div className="content-page">
      <PageHeader
        title="All Posts"
        description="Manage user-generated content posts"
        icon="fa-newspaper"
      />

      {error && (
        <div className="content-error">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        stats && (
          <div className="content-stats-grid">
            <StatsCard
              title="Toplam"
              value={stats.total}
              icon="fa-newspaper"
              color="accent"
            />
            <StatsCard
              title="Boosted"
              value={stats.boostedCount}
              icon="fa-fire"
              color="success"
            />
            <StatsCard
              title="Event'e bağlı"
              value={stats.withEventCount}
              icon="fa-calendar"
              color="neutral"
            />
            <StatsCard
              title="Türe göre"
              value={Object.keys(stats.byType).length}
              icon="fa-tags"
              color="neutral"
            />
          </div>
        )
      )}

      <DataCard
        title="Post listesi"
        action={
          <div className="content-filters">
            <input
              type="text"
              placeholder="Ara (başlık, içerik)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="content-filter-input"
            />
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="content-filter-select"
            >
              {POST_TYPES.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortField);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="content-filter-select"
            >
              <option value="createdAt">Oluşturulma</option>
              <option value="likesCount">Beğeni</option>
              <option value="commentsCount">Yorum</option>
              <option value="viewsCount">Görüntülenme</option>
              <option value="title">Başlık</option>
            </select>
            <select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value as 'asc' | 'desc');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="content-filter-select"
            >
              <option value="desc">Azalan</option>
              <option value="asc">Artan</option>
            </select>
          </div>
        }
      >
        {loadingList ? (
          <div className="content-loading">
            <LoadingSpinner />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon="fa-newspaper"
            title="Post bulunamadı"
            description="Filtreleri değiştirerek tekrar deneyin."
          />
        ) : (
          <>
            <div className="content-table-wrap">
              <table className="content-table">
                <thead>
                  <tr>
                    <th className="col-thumb" scope="col">Görsel</th>
                    <th className="col-title" scope="col">Başlık</th>
                    <th>Tür</th>
                    <th>Yazar</th>
                    <th>Beğeni</th>
                    <th>Yorum</th>
                    <th>Boosted</th>
                    <th>Oluşturulma</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id}>
                      <td className="col-thumb">
                        {p.thumbnailUrl ? (
                          <img
                            src={p.thumbnailUrl}
                            alt=""
                            className="content-thumb"
                            loading="lazy"
                          />
                        ) : (
                          <span className="content-thumb-placeholder">—</span>
                        )}
                      </td>
                      <td className="col-title">
                        <span title={titleDisplay(p) !== '—' ? titleDisplay(p) : undefined}>
                          {titleDisplay(p).length > 80 ? titleDisplay(p).slice(0, 80) + '…' : titleDisplay(p)}
                        </span>
                      </td>
                      <td>
                        <span className={`content-badge ${typeBadgeClass(p.type)}`}>
                          {p.type}
                        </span>
                      </td>
                      <td>
                        <Link to={`/users/${p.userId}`} className="content-link">
                          {userDisplay(p)}
                        </Link>
                      </td>
                      <td className="tabular-nums">{p.likesCount}</td>
                      <td className="tabular-nums">{p.commentsCount}</td>
                      <td>{p.isBoosted ? 'Evet' : '—'}</td>
                      <td>
                        {p.createdAt
                          ? new Date(p.createdAt).toLocaleDateString('tr-TR')
                          : '—'}
                      </td>
                      <td>
                        <Link to={`/content/posts/${p.id}`} className="content-link">
                          Detay
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="content-pagination">
              <span className="content-pagination-info">
                {pagination.total} kayıt, sayfa {currentPage} / {totalPages}
              </span>
              <div className="content-pagination-btns">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pagination.offset === 0}
                  onClick={() =>
                    setPagination((p) => ({
                      ...p,
                      offset: Math.max(0, p.offset - p.limit),
                    }))
                  }
                >
                  Önceki
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                  onClick={() =>
                    setPagination((p) => ({ ...p, offset: p.offset + p.limit }))
                  }
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

export default ContentPosts;

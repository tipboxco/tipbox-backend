import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import StatsCard from '../../components/StatsCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
  fetchContentCommentsStats,
  fetchContentComments,
} from '../../api/admin-content';
import type {
  AdminContentCommentStatsResponse,
  AdminContentCommentListItem,
} from '../../types/admin';
import './content.css';

const PAGE_SIZE = 20;

function ContentComments() {
  const [stats, setStats] = useState<AdminContentCommentStatsResponse | null>(null);
  const [comments, setComments] = useState<AdminContentCommentListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [postId, setPostId] = useState('');
  const [userId, setUserId] = useState('');
  const [sort, setSort] = useState<'createdAt' | 'likesCount'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchContentCommentsStats();
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
        const res = await fetchContentComments({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          postId: postId || undefined,
          userId: userId || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setComments(res.data ?? []);
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
  }, [pagination.offset, postId, userId, sort, order]);

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const userDisplay = (c: AdminContentCommentListItem) =>
    c.userDisplayName || c.userName || c.userId?.slice(0, 8) || '—';

  return (
    <div className="content-page">
      <PageHeader
        title="Comments"
        description="Moderate user comments"
        icon="fa-comments"
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
              title="Toplam yorum"
              value={stats.total}
              icon="fa-comments"
              color="accent"
            />
          </div>
        )
      )}

      <DataCard
        title="Yorum listesi"
        action={
          <div className="content-filters">
            <input
              type="text"
              placeholder="Post ID"
              value={postId}
              onChange={(e) => {
                setPostId(e.target.value.trim());
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="content-filter-input"
            />
            <input
              type="text"
              placeholder="User ID (UUID)"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value.trim());
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="content-filter-input"
            />
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'createdAt' | 'likesCount');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="content-filter-select"
            >
              <option value="createdAt">Oluşturulma</option>
              <option value="likesCount">Beğeni</option>
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
        ) : comments.length === 0 ? (
          <EmptyState
            icon="fa-comments"
            title="Yorum bulunamadı"
            description="Filtreleri değiştirerek tekrar deneyin."
          />
        ) : (
          <>
            <div className="content-table-wrap">
              <table className="content-table">
                <thead>
                  <tr>
                    <th>Yorum (özet)</th>
                    <th>Post</th>
                    <th>Yazar</th>
                    <th>Cevap mı</th>
                    <th>Beğeni</th>
                    <th>Oluşturulma</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {comments.map((c) => (
                    <tr key={c.id}>
                      <td title={c.comment}>
                        {c.commentExcerpt ?? (c.comment.length > 80 ? c.comment.slice(0, 80) + '…' : c.comment)}
                      </td>
                      <td>
                        <Link to={`/content/posts/${c.postId}`} className="content-link">
                          {c.postTitle ? (c.postTitle.length > 30 ? c.postTitle.slice(0, 30) + '…' : c.postTitle) : c.postId}
                        </Link>
                      </td>
                      <td>
                        <Link to={`/users/${c.userId}`} className="content-link">
                          {userDisplay(c)}
                        </Link>
                      </td>
                      <td>{c.isAnswer ? 'Evet' : '—'}</td>
                      <td className="tabular-nums">{c.likesCount}</td>
                      <td>
                        {c.createdAt
                          ? new Date(c.createdAt).toLocaleDateString('tr-TR')
                          : '—'}
                      </td>
                      <td>
                        <Link to={`/content/posts/${c.postId}`} className="content-link">
                          Post detay
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

export default ContentComments;

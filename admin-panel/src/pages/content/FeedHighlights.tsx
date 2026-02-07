import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
  fetchFeedHighlights,
  createFeedHighlight,
  updateFeedHighlight,
  deleteFeedHighlight,
} from '../../api/admin-content';
import type { AdminFeedHighlightListItem } from '../../types/admin';
import './content.css';

const PAGE_SIZE = 20;

const REASONS = [
  { value: 'STAFF_PICK', label: 'Staff Pick' },
  { value: 'MOST_LIKED', label: 'Most Liked' },
  { value: 'BOOSTED', label: 'Boosted' },
];

function FeedHighlights() {
  const [rows, setRows] = useState<AdminFeedHighlightListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [reasonFilter, setReasonFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newPostId, setNewPostId] = useState('');
  const [newReason, setNewReason] = useState('STAFF_PICK');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchFeedHighlights({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        reason: reasonFilter || undefined,
      });
      setRows(res.data ?? []);
      if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pagination.offset, reasonFilter]);

  const handleAdd = async () => {
    if (!newPostId.trim()) return;
    setActionLoading('add');
    try {
      await createFeedHighlight({
        postId: newPostId.trim(),
        reason: newReason,
      });
      setShowAdd(false);
      setNewPostId('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu highlight kaldırılsın mı?')) return;
    setActionLoading(id);
    try {
      await deleteFeedHighlight(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaldırılamadı');
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="content-page">
      <PageHeader
        title="Feed Highlights"
        description="Manage feed highlighted posts"
        icon="fa-star"
      />

      {error && (
        <div className="content-error">
          <span>{error}</span>
        </div>
      )}

      <DataCard
        title="Feed highlight listesi"
        action={
          <div className="content-filters">
            <select
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="content-filter-select"
            >
              <option value="">Tüm sebepler</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <Button size="sm" variant="primary" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? 'İptal' : 'Highlight ekle'}
            </Button>
          </div>
        }
      >
        {showAdd && (
          <div className="content-detail-section" style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Post ID"
              value={newPostId}
              onChange={(e) => setNewPostId(e.target.value)}
              className="content-filter-input"
              style={{ marginRight: 8 }}
            />
            <select
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="content-filter-select"
              style={{ marginRight: 8 }}
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="primary"
              disabled={actionLoading === 'add'}
              onClick={handleAdd}
            >
              Ekle
            </Button>
          </div>
        )}

        {loading ? (
          <div className="content-loading">
            <LoadingSpinner />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="fa-star"
            title="Highlight yok"
            description="Filtreleri değiştirin veya yeni ekleyin."
          />
        ) : (
          <>
            <div className="content-table-wrap">
              <table className="content-table">
                <thead>
                  <tr>
                    <th>Post</th>
                    <th>Yazar</th>
                    <th>Sebep</th>
                    <th>Öne çıkarılma</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/content/posts/${r.postId}`} className="content-link">
                          {r.postTitle ? (r.postTitle.length > 40 ? r.postTitle.slice(0, 40) + '…' : r.postTitle) : r.postId}
                        </Link>
                      </td>
                      <td>{r.userDisplayName ?? '—'}</td>
                      <td>{r.reason}</td>
                      <td>{new Date(r.highlightedAt).toLocaleString('tr-TR')}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={actionLoading === r.id}
                          onClick={() => handleDelete(r.id)}
                        >
                          Kaldır
                        </Button>
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

export default FeedHighlights;

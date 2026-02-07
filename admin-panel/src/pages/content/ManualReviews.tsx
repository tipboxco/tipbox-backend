import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
  fetchManualReviewFlags,
  updateManualReviewFlag,
} from '../../api/admin-content';
import type { AdminManualReviewFlagListItem } from '../../types/admin';
import './content.css';

const PAGE_SIZE = 20;

function ManualReviews() {
  const [flags, setFlags] = useState<AdminManualReviewFlagListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchManualReviewFlags({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          status: statusFilter || undefined,
        });
        if (!cancelled) {
          setFlags(res.data ?? []);
          if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, statusFilter]);

  const handleResolve = async (id: string) => {
    setActionLoading(id);
    try {
      await updateManualReviewFlag(id, { status: 'RESOLVED' });
      setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'RESOLVED' } : f)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="content-page">
      <PageHeader
        title="Manual Reviews"
        description="Content flagged for manual review"
        icon="fa-magnifying-glass"
      />

      {error && (
        <div className="content-error">
          <span>{error}</span>
        </div>
      )}

      <DataCard
        title="Manuel inceleme flag'leri"
        action={
          <div className="content-filters">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="content-filter-select"
            >
              <option value="">Tüm durumlar</option>
              <option value="OPEN">OPEN</option>
              <option value="IN_REVIEW">IN_REVIEW</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </div>
        }
      >
        {loading ? (
          <div className="content-loading">
            <LoadingSpinner />
          </div>
        ) : flags.length === 0 ? (
          <EmptyState
            icon="fa-magnifying-glass"
            title="Flag bulunamadı"
            description="Filtreleri değiştirerek tekrar deneyin."
          />
        ) : (
          <>
            <div className="content-table-wrap">
              <table className="content-table">
                <thead>
                  <tr>
                    <th>Content</th>
                    <th>Sebep</th>
                    <th>Flagleyen</th>
                    <th>Durum</th>
                    <th>Oluşturulma</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((f) => (
                    <tr key={f.id}>
                      <td>
                        {f.contentType}#{f.contentId}
                      </td>
                      <td title={f.reason}>
                        {f.reason.length > 60 ? f.reason.slice(0, 60) + '…' : f.reason}
                      </td>
                      <td>
                        <Link to={`/users/${f.flaggedByUserId}`} className="content-link">
                          {f.flaggedByUserDisplayName || f.flaggedByUserEmail || f.flaggedByUserId?.slice(0, 8)}
                        </Link>
                      </td>
                      <td>{f.status}</td>
                      <td>{new Date(f.createdAt).toLocaleString('tr-TR')}</td>
                      <td>
                        {f.status !== 'RESOLVED' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={actionLoading === f.id}
                            onClick={() => handleResolve(f.id)}
                          >
                            Çözüldü işaretle
                          </Button>
                        )}
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

export default ManualReviews;

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { fetchUserTrustScoresList } from '../../api/admin-trust';
import type { AdminTrustScoreListItem } from '../../types/admin';
import './users.css';

const PAGE_SIZE = 20;

function UserTrustScores() {
  const [scores, setScores] = useState<AdminTrustScoreListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'score' | 'createdAt' | 'calculatedAt'>('calculatedAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchUserTrustScoresList({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          sort,
          order,
        });
        if (!cancelled) {
          setScores(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pagination.offset, sort, order]);

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="users-page">
      <PageHeader
        title="Trust skorları"
        description="Kullanıcı trust skorlarını listele ve incele"
        icon="fa-handshake"
      />

      {error && (
        <div className="users-error">
          <span>{error}</span>
        </div>
      )}

      <DataCard
        title="Trust skor listesi"
        action={
          <div className="users-filters">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'score' | 'createdAt' | 'calculatedAt');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="users-filter-select"
            >
              <option value="calculatedAt">Hesaplanma tarihi</option>
              <option value="score">Skor</option>
              <option value="createdAt">Oluşturulma</option>
            </select>
            <select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value as 'asc' | 'desc');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="users-filter-select"
            >
              <option value="desc">Azalan</option>
              <option value="asc">Artan</option>
            </select>
          </div>
        }
      >
        {loading ? (
          <div className="users-loading">
            <LoadingSpinner />
          </div>
        ) : scores.length === 0 ? (
          <EmptyState
            icon="fa-handshake"
            title="Kayıt bulunamadı"
            description="Trust skor kaydı yok."
          />
        ) : (
          <>
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Kullanıcı</th>
                    <th>Skor</th>
                    <th>Gerekçe</th>
                    <th>Hesaplanma</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s) => (
                    <tr key={s.id}>
                      <td>{s.userEmail ?? s.userId}</td>
                      <td className="tabular-nums">{s.score}</td>
                      <td>{s.reason ?? '—'}</td>
                      <td>{new Date(s.calculatedAt).toLocaleString('tr-TR')}</td>
                      <td>
                        <Link to={`/users/${s.userId}`} className="users-link">
                          Kullanıcı detayı
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="users-pagination">
              <span className="users-pagination-info">
                {pagination.total} kayıt, sayfa {currentPage} / {totalPages}
              </span>
              <div className="users-pagination-btns">
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

export default UserTrustScores;

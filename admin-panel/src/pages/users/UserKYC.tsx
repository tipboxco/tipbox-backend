import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { fetchUserKycList } from '../../api/admin-kyc';
import type { AdminKycListItem } from '../../types/admin';
import './users.css';

const PAGE_SIZE = 20;

function UserKYC() {
  const [records, setRecords] = useState<AdminKycListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState<string>('');
  const [reviewResult, setReviewResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchUserKycList({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          reviewStatus: reviewStatus || undefined,
          reviewResult: reviewResult || undefined,
        });
        if (!cancelled) {
          setRecords(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pagination.offset, reviewStatus, reviewResult]);

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="users-page">
      <PageHeader
        title="KYC doğrulama"
        description="Kullanıcı KYC kayıtlarını inceleyin ve onaylayın"
        icon="fa-id-card"
      />

      {error && (
        <div className="users-error">
          <span>{error}</span>
        </div>
      )}

      <DataCard
        title="KYC kayıtları"
        action={
          <div className="users-filters">
            <select
              value={reviewStatus}
              onChange={(e) => {
                setReviewStatus(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="users-filter-select"
            >
              <option value="">Tüm durumlar</option>
              <option value="INIT">INIT</option>
              <option value="PENDING">PENDING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="DECLINED">DECLINED</option>
              <option value="ON_HOLD">ON_HOLD</option>
            </select>
            <select
              value={reviewResult}
              onChange={(e) => {
                setReviewResult(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="users-filter-select"
            >
              <option value="">Tüm sonuçlar</option>
              <option value="GREEN">GREEN</option>
              <option value="YELLOW">YELLOW</option>
              <option value="RED">RED</option>
            </select>
          </div>
        }
      >
        {loading ? (
          <div className="users-loading">
            <LoadingSpinner />
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon="fa-id-card"
            title="KYC kaydı bulunamadı"
            description="Filtreleri değiştirerek tekrar deneyin."
          />
        ) : (
          <>
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Kullanıcı</th>
                    <th>Sumsub ID</th>
                    <th>İnceleme durumu</th>
                    <th>Sonuç</th>
                    <th>KYC seviye</th>
                    <th>Tarih</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td>{r.userEmail ?? r.userId}</td>
                      <td className="users-cell-truncate" title={r.sumsubApplicantId}>
                        {r.sumsubApplicantId?.slice(0, 12)}…
                      </td>
                      <td>{r.reviewStatus}</td>
                      <td>{r.reviewResult}</td>
                      <td>{r.kycLevel ?? '—'}</td>
                      <td>{new Date(r.createdAt).toLocaleString('tr-TR')}</td>
                      <td>
                        <Link to={`/users/kyc/${r.userId}`} className="users-link">
                          İncele
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

export default UserKYC;

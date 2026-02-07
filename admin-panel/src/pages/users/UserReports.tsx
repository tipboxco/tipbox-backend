import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { fetchUserReports } from '../../api/admin-reports';
import type { AdminUserReportListItem } from '../../types/admin';
import './users.css';

const PAGE_SIZE = 20;

function UserReports() {
  const [reports, setReports] = useState<AdminUserReportListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('');
  const [resolved, setResolved] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchUserReports({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          category: category || undefined,
          sort: 'createdAt',
          order: 'desc',
        });
        if (!cancelled) {
          setReports(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pagination.offset, category]);

  const filteredReports = resolved === ''
    ? reports
    : resolved === 'true'
      ? reports.filter((r) => r.resolved)
      : reports.filter((r) => !r.resolved);

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="users-page">
      <PageHeader
        title="Kullanıcı şikayetleri"
        description="Kullanıcı raporlarını inceleyin ve çözümleyin"
        icon="fa-flag"
      />

      {error && (
        <div className="users-error">
          <span>{error}</span>
        </div>
      )}

      <DataCard
        title="Rapor listesi"
        action={
          <div className="users-filters">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="users-filter-select"
            >
              <option value="">Tüm kategoriler</option>
              <option value="SPAM">SPAM</option>
              <option value="ABUSE">ABUSE</option>
              <option value="OTHER">OTHER</option>
            </select>
            <select
              value={resolved}
              onChange={(e) => setResolved(e.target.value)}
              className="users-filter-select"
            >
              <option value="">Tümü</option>
              <option value="true">Çözüldü</option>
              <option value="false">Bekleyen</option>
            </select>
          </div>
        }
      >
        {loading ? (
          <div className="users-loading">
            <LoadingSpinner />
          </div>
        ) : filteredReports.length === 0 ? (
          <EmptyState
            icon="fa-flag"
            title="Rapor bulunamadı"
            description="Filtreleri değiştirerek tekrar deneyin."
          />
        ) : (
          <>
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Kategori</th>
                    <th>Şikayet edilen</th>
                    <th>Şikayet eden</th>
                    <th>Durum</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.createdAt).toLocaleString('tr-TR')}</td>
                      <td>{r.category}</td>
                      <td>{r.reportedUserDisplayName ?? r.reportedUserEmail ?? r.reportedUserId}</td>
                      <td>{r.reporterDisplayName ?? r.reporterEmail ?? r.reporterId}</td>
                      <td>
                        <span className={`users-badge ${r.resolved ? 'users-badge-success' : 'users-badge-neutral'}`}>
                          {r.resolved ? 'Çözüldü' : 'Bekliyor'}
                        </span>
                      </td>
                      <td>
                        <Link to={`/users/reports/${r.id}`} className="users-link">
                          Detay
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

export default UserReports;

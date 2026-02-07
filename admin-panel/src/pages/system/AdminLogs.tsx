import { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { fetchAdminLogs } from '../../api/admin-logs';
import type { AdminLogListItem } from '../../types/admin';
import './AdminLogs.css';

const PAGE_SIZE = 50;

function AdminLogs() {
  const [logs, setLogs] = useState<AdminLogListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchAdminLogs({ limit: PAGE_SIZE, offset: pagination.offset });
        if (!cancelled) {
          setLogs(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Loglar yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pagination.offset]);

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="admin-logs-page">
      <PageHeader
        title="Admin Logs"
        description="Admin işlem geçmişi"
        icon="fa-clock-rotate-left"
      />

      {error && (
        <div className="admin-logs-error" role="alert">
          {error}
        </div>
      )}

      <DataCard title="Admin işlem logları">
        {loading ? (
          <LoadingSpinner fullScreen={false} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon="fa-clock-rotate-left"
            title="Kayıt yok"
            description="Henüz admin log kaydı bulunmuyor."
          />
        ) : (
          <>
            <div className="admin-logs-table-wrap">
              <table className="admin-logs-table">
                <thead>
                  <tr>
                    <th>Kayıt ID</th>
                    <th>Tarih</th>
                    <th>Admin ID</th>
                    <th>İşlem</th>
                    <th>Açıklama</th>
                    <th>Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="admin-logs-id-cell" title={log.id}>
                        {log.id}
                      </td>
                      <td>{new Date(log.createdAt).toLocaleString('tr-TR')}</td>
                      <td className="admin-logs-id-cell" title={log.adminId}>
                        {log.adminId}
                      </td>
                      <td>{log.action}</td>
                      <td>{log.description ?? '—'}</td>
                      <td>{log.entityType} {log.entityId ? `#${log.entityId}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-logs-pagination">
              <span className="admin-logs-pagination-info">
                Toplam {pagination.total} kayıt, sayfa {currentPage} / {totalPages}
              </span>
              <div className="admin-logs-pagination-btns">
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

export default AdminLogs;

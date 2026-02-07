import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
  fetchManualReviewFlags,
  fetchModerationActions,
  updateManualReviewFlag,
} from '../../api/admin-content';
import type {
  AdminManualReviewFlagListItem,
  AdminModerationActionListItem,
} from '../../types/admin';
import './content.css';

const PAGE_SIZE = 20;

function ModerationQueue() {
  const [flags, setFlags] = useState<AdminManualReviewFlagListItem[]>([]);
  const [actions, setActions] = useState<AdminModerationActionListItem[]>([]);
  const [flagsPagination, setFlagsPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [actionsPagination, setActionsPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [loadingActions, setLoadingActions] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'flags' | 'actions'>('flags');

  useEffect(() => {
    let cancelled = false;
    setLoadingFlags(true);
    (async () => {
      try {
        const res = await fetchManualReviewFlags({
          limit: PAGE_SIZE,
          offset: flagsPagination.offset,
          status: statusFilter || undefined,
        });
        if (!cancelled) {
          setFlags(res.data ?? []);
          if (res.pagination) setFlagsPagination((p) => ({ ...p, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Flag listesi yüklenemedi');
      } finally {
        if (!cancelled) setLoadingFlags(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [flagsPagination.offset, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoadingActions(true);
    (async () => {
      try {
        const res = await fetchModerationActions({
          limit: PAGE_SIZE,
          offset: actionsPagination.offset,
        });
        if (!cancelled) {
          setActions(res.data ?? []);
          if (res.pagination) setActionsPagination((p) => ({ ...p, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Aksiyon listesi yüklenemedi');
      } finally {
        if (!cancelled) setLoadingActions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actionsPagination.offset]);

  const handleResolveFlag = async (id: string) => {
    setActionLoading(id);
    try {
      await updateManualReviewFlag(id, { status: 'RESOLVED' });
      setFlags((prev) => prev.filter((f) => f.id !== id));
      setFlagsPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="content-page">
      <PageHeader
        title="Moderation Queue"
        description="Review flagged content"
        icon="fa-shield-halved"
      />

      {error && (
        <div className="content-error">
          <span>{error}</span>
        </div>
      )}

      <DataCard
        title="Kuyruk"
        action={
          <div className="content-filters">
            <button
              type="button"
              className={activeTab === 'flags' ? 'content-link' : ''}
              style={{ marginRight: 8, background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setActiveTab('flags')}
            >
              Manual Review Flags
            </button>
            <button
              type="button"
              className={activeTab === 'actions' ? 'content-link' : ''}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setActiveTab('actions')}
            >
              Moderation Actions
            </button>
            {activeTab === 'flags' && (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setFlagsPagination((p) => ({ ...p, offset: 0 }));
                }}
                className="content-filter-select"
              >
                <option value="">Tüm durumlar</option>
                <option value="OPEN">OPEN</option>
                <option value="IN_REVIEW">IN_REVIEW</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
            )}
          </div>
        }
      >
        {activeTab === 'flags' && (
          <>
            {loadingFlags ? (
              <div className="content-loading">
                <LoadingSpinner />
              </div>
            ) : flags.length === 0 ? (
              <EmptyState
                icon="fa-flag"
                title="Bekleyen flag yok"
                description="Manuel inceleme bekleyen içerik bulunmuyor."
              />
            ) : (
              <div className="content-table-wrap">
                <table className="content-table">
                  <thead>
                    <tr>
                      <th>Content</th>
                      <th>Sebep</th>
                      <th>Flagleyen</th>
                      <th>Durum</th>
                      <th>Tarih</th>
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
                          {f.reason.length > 50 ? f.reason.slice(0, 50) + '…' : f.reason}
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
                              onClick={() => handleResolveFlag(f.id)}
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
            )}
          </>
        )}

        {activeTab === 'actions' && (
          <>
            {loadingActions ? (
              <div className="content-loading">
                <LoadingSpinner />
              </div>
            ) : actions.length === 0 ? (
              <EmptyState
                icon="fa-list"
                title="Moderation aksiyonu yok"
                description="Henüz kayıtlı moderation aksiyonu bulunmuyor."
              />
            ) : (
              <div className="content-table-wrap">
                <table className="content-table">
                  <thead>
                    <tr>
                      <th>Aksiyon</th>
                      <th>Hedef kullanıcı</th>
                      <th>Sebep</th>
                      <th>Content</th>
                      <th>Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((a) => (
                      <tr key={a.id}>
                        <td>{a.actionType}</td>
                        <td>
                          <Link to={`/users/${a.targetUserId}`} className="content-link">
                            {a.targetUserDisplayName || a.targetUserEmail || a.targetUserId?.slice(0, 8)}
                          </Link>
                        </td>
                        <td title={a.reason}>
                          {a.reason.length > 40 ? a.reason.slice(0, 40) + '…' : a.reason}
                        </td>
                        <td>
                          {a.contentType && a.contentId != null
                            ? `${a.contentType}#${a.contentId}`
                            : '—'}
                        </td>
                        <td>{new Date(a.createdAt).toLocaleString('tr-TR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </DataCard>
    </div>
  );
}

export default ModerationQueue;

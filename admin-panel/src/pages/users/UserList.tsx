import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import StatsCard from '../../components/StatsCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { fetchUsersStats, fetchUsers } from '../../api/admin-users';
import type { AdminUserListItem, AdminUsersStatsResponse } from '../../types/admin';
import './users.css';

const PAGE_SIZE = 20;

function UserList() {
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState<AdminUsersStatsResponse | null>(null);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState<string>(searchParams.get('status') ?? '');
  const [emailVerified, setEmailVerified] = useState<string>(searchParams.get('emailVerified') ?? '');
  const [sort, setSort] = useState<'email' | 'createdAt'>((searchParams.get('sort') as 'email' | 'createdAt') ?? 'createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>((searchParams.get('order') as 'asc' | 'desc') ?? 'desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchUsersStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'İstatistikler yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    (async () => {
      try {
        const res = await fetchUsers({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          status: status || undefined,
          emailVerified: emailVerified === 'true' ? true : emailVerified === 'false' ? false : undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setUsers(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pagination.offset, search, status, emailVerified, sort, order]);

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="users-page">
      <PageHeader
        title="Kullanıcılar"
        description="Platform kullanıcılarını listele, filtrele ve yönet"
        icon="fa-users"
      />

      {error && (
        <div className="users-error">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : stats && (
        <div className="users-stats-grid">
          <StatsCard title="Toplam" value={stats.total} icon="fa-users" color="accent" />
          <StatsCard title="Yasaklı" value={stats.bannedCount} icon="fa-user-slash" color="danger" />
          <StatsCard title="Email Doğrulu" value={stats.emailVerifiedCount} icon="fa-envelope-circle-check" color="success" />
          <StatsCard title="Bu Hafta Yeni" value={stats.newThisWeek} icon="fa-user-plus" color="neutral" />
        </div>
      )}

      <DataCard
        title="Kullanıcı listesi"
        action={
          <div className="users-filters">
            <input
              type="text"
              placeholder="Ara (email, displayName, userName)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="users-filter-input"
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="users-filter-select"
            >
              <option value="">Tüm durumlar</option>
              <option value="ACTIVE">Aktif</option>
              <option value="BANNED">Yasaklı</option>
            </select>
            <select
              value={emailVerified}
              onChange={(e) => {
                setEmailVerified(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="users-filter-select"
            >
              <option value="">Email doğrulama</option>
              <option value="true">Doğrulanmış</option>
              <option value="false">Doğrulanmamış</option>
            </select>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'email' | 'createdAt');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="users-filter-select"
            >
              <option value="createdAt">Tarih</option>
              <option value="email">Email</option>
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
        {loadingList ? (
          <div className="users-loading">
            <LoadingSpinner />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon="fa-users"
            title="Kullanıcı bulunamadı"
            description="Filtreleri değiştirerek tekrar deneyin."
          />
        ) : (
          <>
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Görünen ad</th>
                    <th>Kullanıcı adı</th>
                    <th>Email</th>
                    <th>Durum</th>
                    <th>Email doğru</th>
                    <th>Kayıt</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.displayName ?? '—'}</td>
                      <td>{u.userName ?? '—'}</td>
                      <td>{u.email ?? '—'}</td>
                      <td>
                        <span className={`users-badge users-badge-${u.status === 'BANNED' ? 'danger' : 'neutral'}`}>
                          {u.status ?? '—'}
                        </span>
                      </td>
                      <td>{u.emailVerified ? 'Evet' : 'Hayır'}</td>
                      <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '—'}</td>
                      <td>
                        <Link to={`/users/${u.id}`} className="users-link">
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

export default UserList;

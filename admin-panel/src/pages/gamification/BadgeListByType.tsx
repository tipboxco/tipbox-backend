import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { fetchBadges } from '../../api/admin-badges-collections';
import type { AdminBadgeListItem } from '../../types/admin';
import './gamification.css';

const PAGE_SIZE = 20;

export type BadgeTypeSlug = 'EVENT' | 'BRAND' | 'COSMETIC';

export interface BadgeListByTypeProps {
  badgeType: BadgeTypeSlug;
  listPath: string;
  title: string;
  description: string;
  icon?: string;
  onOpenCreate?: () => void;
}

function BadgeListByType({
  badgeType,
  listPath,
  title,
  description,
  icon = 'fa-medal',
  onOpenCreate,
}: BadgeListByTypeProps) {
  const [badges, setBadges] = useState<AdminBadgeListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState<string>('');
  const [sort, setSort] = useState<'createdAt' | 'name'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    (async () => {
      try {
        const res = await fetchBadges({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          type: badgeType,
          rarity: rarity || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setBadges(res.data ?? []);
          if (res.pagination) setPagination((prev) => ({ ...prev, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [badgeType, pagination.offset, search, rarity, sort, order]);

  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="gamification-page">
      <PageHeader
        title={title}
        description={description}
        icon={icon}
      />

      {error && (
        <div className="gamification-error">
          <span>{error}</span>
        </div>
      )}

      <DataCard
        title={`${title} listesi`}
        action={
          <div className="gamification-filters">
            {onOpenCreate && (
              <Button variant="primary" size="sm" onClick={onOpenCreate}>
                Yeni badge
              </Button>
            )}
            <input
              type="text"
              placeholder="Ara (ad, açıklama)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="gamification-filter-input"
            />
            <select
              value={rarity}
              onChange={(e) => {
                setRarity(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="gamification-filter-select"
            >
              <option value="">Tüm rarity</option>
              <option value="COMMON">COMMON</option>
              <option value="RARE">RARE</option>
              <option value="EPIC">EPIC</option>
            </select>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'createdAt' | 'name');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="gamification-filter-select"
            >
              <option value="createdAt">Oluşturulma</option>
              <option value="name">Ad</option>
            </select>
            <select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value as 'asc' | 'desc');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              className="gamification-filter-select"
            >
              <option value="desc">Azalan</option>
              <option value="asc">Artan</option>
            </select>
          </div>
        }
      >
        {loadingList ? (
          <div className="gamification-loading">
            <LoadingSpinner />
          </div>
        ) : badges.length === 0 ? (
          <EmptyState
            icon={icon}
            title="Badge bulunamadı"
            description="Filtreleri değiştirin veya yeni badge oluşturun."
          />
        ) : (
          <>
            <div className="gamification-table-wrap">
              <table className="gamification-table">
                <thead>
                  <tr>
                    <th>Ad</th>
                    <th>Rarity</th>
                    <th>Kategori</th>
                    <th>Oluşturulma</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {badges.map((b) => (
                    <tr key={b.id}>
                      <td>
                        {b.imageUrl && (
                          <img src={b.imageUrl} alt="" className="gamification-badge-thumb" />
                        )}
                        <span>{b.name}</span>
                      </td>
                      <td>{b.rarity}</td>
                      <td>{b.categoryName ?? b.categoryId}</td>
                      <td>{new Date(b.createdAt).toLocaleString('tr-TR')}</td>
                      <td>
                        <Link to={`${listPath}/${b.id}`}>
                          <Button variant="secondary" size="sm">
                            Detay
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination.total > pagination.limit && (
              <div className="gamification-pagination">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    setPagination((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))
                  }
                >
                  Önceki
                </Button>
                <span className="gamification-pagination-info">
                  {currentPage} / {totalPages} (toplam {pagination.total})
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setPagination((p) => ({
                      ...p,
                      offset: Math.min(pagination.total, p.offset + p.limit),
                    }))
                  }
                >
                  Sonraki
                </Button>
              </div>
            )}
          </>
        )}
      </DataCard>
    </div>
  );
}

export default BadgeListByType;

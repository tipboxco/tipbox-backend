import { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { fetchContentTags } from '../../api/admin-content';
import type { AdminContentTagListItem } from '../../types/admin';
import './content.css';

const PAGE_SIZE = 50;

function TagsCategories() {
  const [tags, setTags] = useState<AdminContentTagListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchContentTags({
          limit: PAGE_SIZE,
          offset: 0,
          search: search || undefined,
        });
        if (!cancelled) setTags(res.data ?? []);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Tag listesi yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search]);

  return (
    <div className="content-page">
      <PageHeader
        title="Tags & Categories"
        description="Manage content tags and categories"
        icon="fa-tags"
      />

      {error && (
        <div className="content-error">
          <span>{error}</span>
        </div>
      )}

      <DataCard
        title="Kullanılan tag'ler"
        action={
          <div className="content-filters">
            <input
              type="text"
              placeholder="Tag ara"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="content-filter-input"
            />
          </div>
        }
      >
        {loading ? (
          <div className="content-loading">
            <LoadingSpinner />
          </div>
        ) : tags.length === 0 ? (
          <EmptyState
            icon="fa-tags"
            title="Tag bulunamadı"
            description="İçeriklerde kullanılan tag'ler burada listelenir."
          />
        ) : (
          <div className="content-table-wrap">
            <table className="content-table">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Kullanım sayısı</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t) => (
                  <tr key={t.tag}>
                    <td>{t.tag}</td>
                    <td className="tabular-nums">{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <DataCard title="Kategoriler" className="content-detail-section">
        <p className="content-detail-meta">
          Kategori, ana kategori ve alt kategori yönetimi için{' '}
          <a href="/products/categories" className="content-link">
            Ürün Kategorileri
          </a>{' '}
          sayfasını kullanın.
        </p>
      </DataCard>
    </div>
  );
}

export default TagsCategories;
